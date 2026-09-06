# Load trained weights, evaluate honestly (batched), export TFLite (plain + int8)
import os, sys, json, time, random, tracemalloc
sys.stdout.reconfigure(encoding="utf-8")
import numpy as np
import tensorflow as tf
import sacrebleu

CORPUS = os.path.join(os.path.dirname(__file__), "..", "corpus")
MODEL = os.path.join(os.path.dirname(__file__), "..", "model")
os.makedirs(MODEL, exist_ok=True)
SOS, EOS, PAD = "<s>", "</s>", "<p>"

def read_tsv(path):
    rows = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            p = line.rstrip("\n").split("\t", 2)
            if len(p) == 3: rows.append((p[1], p[2]))
    return rows

def build_vocab(pairs):
    chars = set()
    for h, s in pairs: chars.update(h); chars.update(s)
    v = {SOS:0, EOS:1, PAD:2}
    for c in sorted(chars): v[c] = len(v)
    return v

class Tokenizer:
    def __init__(self, v): self.v=v; self.inv={i:c for c,i in v.items()}
    def encode(self, s, n):
        ids=[self.v.get(c,2) for c in s]
        return [self.v[SOS]]+ids+[self.v[EOS]][:n-len([self.v[SOS]]+ids)] if len([self.v[SOS]]+ids)+1<=n else [self.v[SOS]]+ids[:n-2]
    def decode(self, ids):
        return "".join(self.inv.get(i,"") for i in ids if i not in (0,1,2))

class Model(tf.keras.Model):
    def __init__(self, hi_v, sat_v, emb=32, hid=64):
        super().__init__()
        self.emb_hi=tf.keras.layers.Embedding(len(hi_v),emb)
        self.enc=tf.keras.layers.GRU(hid,return_sequences=True,return_state=True)
        self.emb_sat=tf.keras.layers.Embedding(len(sat_v),emb)
        self.dec_cell=tf.keras.layers.GRUCell(hid)
        self.W1=tf.keras.layers.Dense(hid); self.W2=tf.keras.layers.Dense(hid); self.V=tf.keras.layers.Dense(1)
        self.fc=tf.keras.layers.Dense(len(sat_v))
    def call(self,src,tgt):
        enc_out,state=self.enc(self.emb_hi(src))
        B,L,H=enc_out.shape
        hW2=self.W2(enc_out); sW1=self.W1(state)[:,None,:]
        B = tf.shape(enc_out)[0]
        dec_in = tf.expand_dims(tgt[:, 0], 1)  # <sos>
        outs=[]
        for t in range(tgt.shape[1]):
            emb = tf.reshape(self.emb_sat(dec_in), (B, -1))
            e=tf.nn.softmax(self.V(tf.nn.tanh(sW1+hW2)),axis=1)
            ctx=tf.reduce_sum(e*enc_out,axis=1)
            out,[state]=self.dec_cell(tf.concat([emb,ctx],-1),[state])
            outs.append(self.fc(out)); dec_in=tgt[:,t]
        return tf.stack(outs,axis=1)

def decode_batch(model, tok_hi, tok_sat, X, max_len=25):
    """X: (B,L1) int32. Returns list of decoded strings."""
    enc_out, state = model.enc(model.emb_hi(X))
    B = tf.shape(enc_out)[0]
    hW2 = model.W2(enc_out); sW1 = model.W1(state)[:,None,:]
    dec_in = tf.zeros((B,1), dtype=tf.int32)
    finished = tf.zeros((B,), dtype=tf.bool)
    all_ids = []
    for _ in range(max_len):
        emb = tf.reshape(model.emb_sat(dec_in), (B, -1))
        e = tf.nn.softmax(model.V(tf.nn.tanh(sW1+hW2)), axis=1)
        ctx = tf.reduce_sum(e*enc_out, axis=1)
        out, [state] = model.dec_cell(tf.concat([emb,ctx],-1), [state])
        logits = model.fc(out)
        pred = tf.argmax(logits, axis=-1)  # (B,)
        dec_in = tf.expand_dims(pred, 1)
        all_ids.append(pred)
    ids = tf.stack(all_ids, axis=1).numpy()  # (B, max_len)
    return [tok_sat.decode(ids[i]) for i in range(len(ids))]

def main():
    dev = read_tsv(os.path.join(CORPUS,"dev.tsv"))
    test = read_tsv(os.path.join(CORPUS,"test.tsv"))
    closed = read_tsv(os.path.join(CORPUS,"closed_human_test.tsv"))
    vocab = build_vocab(dev+test)  # small vocab
    vocab = json.load(open(os.path.join(MODEL,"vocab.json"), encoding="utf-8"))
    tok_hi = Tokenizer(vocab); tok_sat = Tokenizer(vocab)
    m = Model(vocab, vocab)
    _ = m(tf.ones((1,25), dtype=tf.int32), tf.ones((1,24), dtype=tf.int32))
    m.load_weights(os.path.join(MODEL,"best.weights.h5")).expect_partial()

    def eval_set(pairs, name):
        refs=[]; hyps=[]
        t0=time.time()
        for i in range(0, len(pairs), 32):
            batch = pairs[i:i+32]
            X = np.array([tok_hi.encode(h,25) for h,s in batch], dtype=np.int32)
            hyps += decode_batch(m, tok_hi, tok_sat, X)
            refs += [s for h,s in batch]
        dur=time.time()-t0
        b=sacrebleu.corpus_bleu(hyps,[[r] for r in refs],tokenize="none")
        cf=sacrebleu.corpus_chrf(hyps,[[r] for r in refs])
        em=sum(1 for h,r in zip(hyps,refs) if h==r)/max(1,len(pairs))
        lat=dur/max(1,len(pairs))*1000
        return {"bleu":round(b.score,2),"chrF":round(cf.score,2),"exact":round(em*100,2),"latency_ms":round(lat,1),"n":len(pairs)}

    res={}
    for nm, pr in [("dev",dev),("test",test),("closed_human",closed)]:
        res[nm]=eval_set(pr,nm)
        print(f"{nm}: {res[nm]}")

    # model size + latency on CPU single sample
    X = np.array([tok_hi.encode(dev[0][0],25)], dtype=np.int32)
    t0=time.time(); _=decode_batch(m,tok_hi,tok_sat,X); lat_ms=(time.time()-t0)*1000
    # RAM snapshot
    tracemalloc.start(); _=decode_batch(m,tok_hi,tok_sat,X); _,peak=tracemalloc.get_traced_memory(); tracemalloc.stop()
    res["model_size_bytes"]=os.path.getsize(os.path.join(MODEL,"model.tflite")) if os.path.exists(os.path.join(MODEL,"model.tflite")) else None
    res["single_latency_ms"]=round(lat_ms,1)
    res["peak_ram_bytes"]=peak
    with open(os.path.join(MODEL,"metrics.json"),"w",encoding="utf-8") as f:
        json.dump(res,f,ensure_ascii=False,indent=2)
    print("metrics:", json.dumps(res, indent=2))

    # TFLite plain
    con = tf.lite.TFLiteConverter.from_keras_model(m)
    tfl = con.convert(); open(os.path.join(MODEL,"model.tflite"),"wb").write(tfl)
    # int8 quantized
    def rep():
        for _ in range(30):
            i=random.randrange(len(dev))
            yield [np.array([tok_hi.encode(dev[i][0],25)],dtype=np.float32)]
    conv=tf.lite.TFLiteConverter.from_keras_model(m)
    conv.optimizations=[tf.lite.Optimize.DEFAULT]; conv.representative_dataset=rep
    conv.target_spec.supported_ops=[tf.lite.OpsSet.TFLITE_BUILTINS_INT8]
    conv.inference_input_type=tf.float32; conv.inference_output_type=tf.float32
    t8=conv.convert(); open(os.path.join(MODEL,"model_int8.tflite"),"wb").write(t8)
    print("model.tflite:", round(os.path.getsize(os.path.join(MODEL,"model.tflite"))/1e6,2),"MB")
    print("model_int8.tflite:", round(os.path.getsize(os.path.join(MODEL,"model_int8.tflite"))/1e6,2),"MB")

if __name__=="__main__":
    main()
# Train a tiny char-level GRU seq2seq Hindi->Santali (Ol Chiki) MT model
# on the REAL data/corpus splits, then evaluate honestly + export TFLite.
import os, sys, json, time, random, io
sys.stdout.reconfigure(encoding="utf-8")
import numpy as np
import tensorflow as tf
import sacrebleu

CORPUS = os.path.join(os.path.dirname(__file__), "..", "corpus")
OUT = os.path.join(os.path.dirname(__file__), "..", "..", "data", "model")
os.makedirs(OUT, exist_ok=True)

SOS, EOS, PAD = "<s>", "</s>", "<p>"

def read_tsv(path):
    rows = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            parts = line.rstrip("\n").split("\t", 2)
            if len(parts) == 3:
                rows.append((parts[1], parts[2]))
    return rows

def build_vocab(pairs):
    chars = set()
    for hi, sat in pairs:
        chars.update(hi)
        chars.update(sat)
    chars = sorted(chars)
    v = {SOS: 0, EOS: 1, PAD: 2}
    for c in chars:
        v[c] = len(v)
    return v

class Tokenizer:
    def __init__(self, vocab):
        self.vocab = vocab
        self.inv = {i: c for c, i in vocab.items()}
    def encode(self, s, max_len=None):
        ids = [self.vocab.get(c, 2) for c in s]
        ids = [self.vocab[SOS]] + ids + [self.vocab[EOS]]
        if max_len is not None:
            ids = ids[:max_len]
        return ids
    def decode(self, ids, drop_special=True):
        out = []
        for i in ids:
            c = self.inv.get(i, "")
            if drop_special and (c == SOS or c == EOS or c == PAD):
                continue
            out.append(c)
        return "".join(out)

def to_matrix(tokenizer, seqs, max_len):
    m = np.zeros((len(seqs), max_len), dtype=np.int32)
    for i, s in enumerate(seqs):
        ids = tokenizer.encode(s, max_len)
        m[i, :len(ids)] = ids
    return m

class Model(tf.keras.Model):
    def __init__(self, hi_v, sat_v,     emb_dim=32, hid=64):
        super().__init__()
        self.emb_hi = tf.keras.layers.Embedding(len(hi_v), emb_dim, mask_zero=False)
        self.enc = tf.keras.layers.GRU(hid, return_sequences=True, return_state=True)
        self.emb_sat = tf.keras.layers.Embedding(len(sat_v), emb_dim)
        self.dec_cell = tf.keras.layers.GRUCell(hid)
        self.attn_W1 = tf.keras.layers.Dense(hid)
        self.attn_W2 = tf.keras.layers.Dense(hid)
        self.attn_V = tf.keras.layers.Dense(1)
        self.fc = tf.keras.layers.Dense(len(sat_v))

    def call(self, src, tgt):
        # src: (B, L1) tgt: (B, L2)
        enc_emb = self.emb_hi(src)
        enc_out, enc_state = self.enc(enc_emb)
        B, L1, H = enc_out.shape
        state = enc_state
        dec_in = tf.expand_dims(tgt[:, 0], 1)  # <sos>
        logits_list = []
        hW2 = self.attn_W2(enc_out)  # (B, L1, H)
        for t in range(tgt.shape[1]):
            emb = tf.reshape(self.emb_sat(dec_in), (tf.shape(dec_in)[0], -1))  # (B, emb)
            # attention
            sW1 = self.attn_W1(state)[:, tf.newaxis, :]         # (B,1,H)
            e = tf.nn.softmax(self.attn_V(tf.nn.tanh(sW1 + hW2)), axis=1)  # (B,L1,1)
            ctx = tf.reduce_sum(e * enc_out, axis=1)             # (B,H)
            rnn_in = tf.concat([emb, ctx], axis=-1)              # (B, 2H)
            out, [state] = self.dec_cell(rnn_in, [state])
            logits_list.append(self.fc(out))
            dec_in = tgt[:, t]
        logits = tf.stack(logits_list, axis=1)
        return logits

def decode_greedy(model, tok_hi, tok_sat, src_ids, max_len=64, hid=128):
    src = tf.constant([src_ids], dtype=tf.int32)
    enc_emb = model.emb_hi(src)
    enc_out, state = model.enc(enc_emb)
    hW2 = model.attn_W2(enc_out)
    dec_in = tf.constant([[0]], dtype=tf.int32)
    out_ids = []
    for _ in range(max_len):
        emb = tf.squeeze(model.emb_sat(dec_in), axis=1)   # (B, emb)
        sW1 = model.attn_W1(state)[:, tf.newaxis, :]
        e = tf.nn.softmax(model.attn_V(tf.nn.tanh(sW1 + hW2)), axis=1)
        ctx = tf.reduce_sum(e * enc_out, axis=1)          # (1, H)
        out, [state] = model.dec_cell(tf.concat([emb, ctx], -1), [state])
        logits = model.fc(out)
        pred = tf.argmax(logits, axis=-1)
        p = int(pred[0])
        if p == tok_sat.vocab[EOS]:
            break
        out_ids.append(p)
        dec_in = tf.reshape(pred, (1, 1))
    return tok_sat.decode(out_ids)

def main():
    train = read_tsv(os.path.join(CORPUS, "train.tsv"))
    dev = read_tsv(os.path.join(CORPUS, "dev.tsv"))
    test = read_tsv(os.path.join(CORPUS, "test.tsv"))
    closed = read_tsv(os.path.join(CORPUS, "closed_human_test.tsv"))
    print("train/dev/test/closed:", len(train), len(dev), len(test), len(closed))

    vocab = build_vocab(train)
    tok_hi = Tokenizer(vocab)
    tok_sat = Tokenizer(vocab)
    print("vocab size:", len(vocab))

    MAX1 = min(max(len(tok_hi.encode(h, None)) for h, s in train), 25)
    MAX2 = min(max(len(tok_sat.encode(s, None)) for h, s in train), 25)
    print("max len hi/sat:", MAX1, MAX2)

    X = to_matrix(tok_hi, [h for h, _ in train], MAX1)
    Y = to_matrix(tok_sat, [s for _, s in train], MAX2)

    model = Model(vocab, vocab)
    opt = tf.keras.optimizers.Adam(0.001)

    @tf.function
    def train_step(xb, yb):
        with tf.GradientTape() as tape:
            logits = model(xb, yb[:, :-1])
            loss = tf.reduce_mean(
                tf.nn.sparse_softmax_cross_entropy_with_logits(
                    logits=logits, labels=yb[:, 1:]))
        grads = tape.gradient(loss, model.trainable_variables)
        opt.apply_gradients(zip(grads, model.trainable_variables))
        return loss

    def evaluate(pairs):
        refs = []; hyps = []
        t0 = time.time()
        for hi, sat in pairs:
            x = tf.constant([tok_hi.encode(hi, MAX1)], dtype=tf.int32)
            y = to_matrix(tok_sat, [sat], MAX2)
            logits = model(x, y[:, :-1])
            h = decode_greedy(model, tok_hi, tok_sat, tok_hi.encode(hi, MAX1))
            refs.append([sat]); hyps.append(h)
        dur = time.time() - t0
        b = sacrebleu.corpus_bleu(hyps, refs, tokenize="none")
        cf = sacrebleu.corpus_chrf(hyps, refs)
        em = sum(1 for h, r in zip(hyps, refs) if h == r[0]) / max(1, len(pairs))
        return {
            "bleu": b.score,
            "chrF": cf.score,
            "exact": round(em * 100, 2),
            "latency_ms": round(dur / max(1, len(pairs)) * 1000, 1) if pairs else 0,
        }

    epochs = 60
    best_dev = -1.0
    es = 0
    random.seed(42)
    for ep in range(epochs):
        idx = list(range(len(X)))
        random.shuffle(idx)
        tot = 0.0; nb = 0
        for i in range(0, len(idx), 64):
            batch = idx[i:i + 64]
            tot += float(train_step(X[batch], Y[batch])); nb += 1
        if ep == epochs - 1 or es >= 8:
            db = evaluate(dev)["bleu"]
            tl = tot / nb
            print(f"ep {ep}: train_loss {tl:.3f} dev_bleu {db:.2f}", flush=True)
            if db > best_dev:
                best_dev = db; es = 0
                model.save_weights(os.path.join(OUT, "best.weights.h5"))
            else:
                es += 1

    model.load_weights(os.path.join(OUT, "best.weights.h5"))
    print("\n== final metrics (real, on-device style greedy decode) ==")
    m_dev = evaluate(dev)
    m_test = evaluate(test)
    m_closed = evaluate(closed)
    for name, m in [("dev", m_dev), ("test", m_test), ("closed(human)", m_closed)]:
        print(f"{name}: BLEU={m['bleu']:.2f} chrF={m['chrF']:.2f} exact={m['exact']}% loss={m['loss']:.3f} latency={m['latency_ms']}ms")

    with open(os.path.join(OUT, "metrics.json"), "w", encoding="utf-8") as f:
        json.dump({"dev": m_dev, "test": m_test, "closed_human": m_closed,
                   "vocab_size": len(vocab), "maxlen": [MAX1, MAX2]}, f, ensure_ascii=False, indent=2)

    with open(os.path.join(OUT, "vocab.json"), "w", encoding="utf-8") as f:
        json.dump(vocab, f, ensure_ascii=False, indent=1)

    con = tf.lite.TFLiteConverter.from_keras_model(model)
    con.target_spec.supported_ops = [tf.lite.OpsSet.TFLITE_BUILTINS]
    tfl = con.convert()
    p = os.path.join(OUT, "model.tflite")
    open(p, "wb").write(tfl)
    print("TFLite plain size:", round(os.path.getsize(p) / 1e6, 2), "MB")

    # int8 quantization with representative data
    def rep():
        for i in range(50):
            i = random.randrange(len(X))
            xb = X[i:i + 1]
            yield [xb.astype(np.float32)]
    conv8 = tf.lite.TFLiteConverter.from_keras_model(model)
    conv8.optimizations = [tf.lite.Optimize.DEFAULT]
    conv8.representative_dataset = rep
    conv8.target_spec.supported_ops = [tf.lite.OpsSet.TFLITE_BUILTINS_INT8]
    conv8.inference_input_type = tf.int8
    conv8.inference_output_type = tf.int8
    # note: int8 I/O would need quantized input pipeline; keep float I/O for compat
    conv8.inference_input_type = tf.float32
    conv8.inference_output_type = tf.float32
    t8 = conv8.convert()
    p8 = os.path.join(OUT, "model_int8.tflite")
    open(p8, "wb").write(t8)
    print("TFLite int8 size:", round(os.path.getsize(p8) / 1e6, 2), "MB")

if __name__ == "__main__":
    main()
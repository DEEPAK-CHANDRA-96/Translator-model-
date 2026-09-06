import os, sys, json, time, random, tracemalloc, numpy as np
sys.stdout.reconfigure(encoding="utf-8")
import tensorflow as tf
import sacrebleu

CORPUS="data/corpus"; MODEL="data/model"; os.makedirs(MODEL,exist_ok=True)
SOS,EOS,PAD="<s>","</s>","<p>"; E=32; H=64

def read(p):
    rows=[]
    for line in open(p,encoding="utf-8"):
        x=line.rstrip("\n").split("\t",2)
        if len(x)==3: rows.append((x[1],x[2]))
    return rows

def vocab(pairs):
    c=set()
    for h,s in pairs: c.update(h); c.update(s)
    v={SOS:0,EOS:1,PAD:2}
    for ch in sorted(c): v[ch]=len(v)
    return v

class Tok:
    def __init__(self,v): self.v=v; self.i={i:c for c,i in v.items()}
    def enc(self,s,n):
        ids=[self.v.get(ch,2) for ch in s]
        return [self.v[SOS]]+ids+[self.v[EOS]]
    def dec(self,ids):
        return "".join(self.i.get(i,"") for i in ids if i not in(0,1,2))

def pad(ids,n,p=2):
    return (ids+[p]*n)[:n]

class M(tf.keras.Model):
    def __init__(self,v):
        super().__init__()
        self.Eh=tf.keras.layers.Embedding(len(v),E)
        self.Es=tf.keras.layers.Embedding(len(v),E)
        self.gru=tf.keras.layers.GRU(H,return_sequences=True,return_state=True)
        self.cell=tf.keras.layers.GRUCell(H)
        self.W1=tf.keras.layers.Dense(H); self.W2=tf.keras.layers.Dense(H); self.V=tf.keras.layers.Dense(1)
        self.fc=tf.keras.layers.Dense(len(v))
    def call(self,src,tgt):
        enc,st=self.gru(self.Eh(src))
        B=tf.shape(enc)[0]
        sW1=self.W1(st)[:,None,:]; hW2=self.W2(enc)
        dec_in=tf.expand_dims(tgt[:,0],1)
        outs=[]
        for t in range(tgt.shape[1]):
            emb=tf.squeeze(self.Es(dec_in), axis=1)
            e=tf.nn.softmax(self.V(tf.nn.tanh(sW1+hW2)),axis=1)
            ctx=tf.reduce_sum(e*enc,axis=1)
            o,[st]=self.cell(tf.concat([emb,ctx],-1),[st])
            outs.append(self.fc(o)); dec_in=tgt[:,t]
        return tf.stack(outs,axis=1)

def decode(model,tk,tok,X,n=25):
    enc,st=model.gru(model.Eh(X)); B=tf.shape(enc)[0]
    sW1=model.W1(st)[:,None,:]; hW2=model.W2(enc)
    dec_in=tf.zeros((B,1),dtype=tf.int32); allp=[]
    for _ in range(n):
        emb=tf.squeeze(model.Es(dec_in), axis=1)
        e=tf.nn.softmax(model.V(tf.nn.tanh(sW1+hW2)),axis=1)
        ctx=tf.reduce_sum(e*enc,axis=1)
        o,[st]=model.cell(tf.concat([emb,ctx],-1),[st])
        dec_in=tf.expand_dims(tf.argmax(model.fc(o),axis=-1),1)
        allp.append(dec_in[:,0].numpy())
    mat=np.stack(allp,axis=1)
    return [tok.dec(mat[i]) for i in range(B)]

def eval_set(model,tk,tok,pairs):
    hyps=[];refs=[]
    for i in range(0,len(pairs),64):
        b=pairs[i:i+64]; X=np.array([pad(tk.enc(h,25),25) for h,s in b],dtype=np.int32)
        hyps+=decode(model,tk,tok,X); refs+=[s for h,s in b]
    b=sacrebleu.corpus_bleu(hyps,[[r] for r in refs],tokenize="none").score
    c=sacrebleu.corpus_chrf(hyps,[[r] for r in refs]).score
    em=sum(1 for h,r in zip(hyps,refs) if h==r)/max(1,len(pairs))*100
    return {"bleu":round(b,2),"chrF":round(c,2),"exact":round(em,2),"n":len(pairs)}

def main():
    tr=read(f"{CORPUS}/train.tsv"); dev=read(f"{CORPUS}/dev.tsv")
    te=read(f"{CORPUS}/test.tsv"); cl=read(f"{CORPUS}/closed_human_test.tsv")
    v=vocab(tr); tk=Tok(v); tok=Tok(v)
    json.dump(v,open(f"{MODEL}/vocab.json","w",encoding="utf-8"),ensure_ascii=False,indent=1)
    N=25
    X=np.array([pad(tk.enc(h,N),N) for h,s in tr],dtype=np.int32)
    Y=np.array([pad(tok.enc(s,N),N) for h,s in tr],dtype=np.int32)
    model=M(v); _=model(tf.ones((2,N),tf.int32),tf.ones((2,N-1),tf.int32))
    opt=tf.keras.optimizers.Adam(0.001); best=-1; es=0; seed=42
    for ep in range(40):
        idx=random.sample(range(len(X)),len(X))
        tot=0
        for i in range(0,len(X),64):
            b=idx[i:i+64]
            with tf.GradientTape() as g:
                l=tf.reduce_mean(tf.nn.sparse_softmax_cross_entropy_with_logits(logits=model(X[b],Y[b][:,:-1]),labels=Y[b][:,1:]))
            opt.apply_gradients(zip(g.gradient(l,model.trainable_variables),model.trainable_variables))
            tot+=float(l)
        if ep%10==0 or ep==39:
            r=eval_set(model,tk,tok,dev)
            print(f"ep{ep} loss={tot/len(X):.3f} dev={r}",flush=True)
            if r["bleu"]>best: best=r["bleu"]; es=0; model.save_weights(f"{MODEL}/best.weights.h5")
            else: es+=1
            if es>=6: break
    model.load_weights(f"{MODEL}/best.weights.h5")
    res={}
    for nm,p in [("dev",dev),("test",te),("closed",cl)]:
        r=eval_set(model,tk,tok,p); res[nm]=r; print(f"{nm}: {r}")
    t0=time.time(); _=decode(model,tk,tok,np.array([pad(tk.enc(dev[0][0],N),N)],dtype=np.int32)); lat=(time.time()-t0)*1000
    tracemalloc.start(); _=decode(model,tk,tok,np.array([pad(tk.enc(dev[0][0],N),N)],dtype=np.int32)); _,peak=tracemalloc.get_traced_memory(); tracemalloc.stop()
    res["latency_ms"]=round(lat,1); res["peak_ram_bytes"]=peak
    json.dump(res,open(f"{MODEL}/metrics.json","w",encoding="utf-8"),ensure_ascii=False,indent=2)
    print("metrics:",json.dumps(res,indent=2))
    cv=tf.lite.TFLiteConverter.from_keras_model(model); tfl=cv.convert()
    open(f"{MODEL}/model.tflite","wb").write(tfl)
    c8=tf.lite.TFLiteConverter.from_keras_model(model); c8.optimizations=[tf.lite.Optimize.DEFAULT]; c8.representative_dataset=lambda: ([np.array([pad(tk.enc(dev[i][0],N),N)],dtype=np.float32) for i in range(30)]); c8.target_spec.supported_ops=[tf.lite.OpsSet.TFLITE_BUILTINS_INT8]; c8.inference_input_type=tf.float32; c8.inference_output_type=tf.float32
    t8=c8.convert(); open(f"{MODEL}/model_int8.tflite","wb").write(t8)
    print("model.tflite:",round(os.path.getsize(f"{MODEL}/model.tflite")/1e6,2),"MB")
    print("model_int8.tflite:",round(os.path.getsize(f"{MODEL}/model_int8.tflite")/1e6,2),"MB")

if __name__=="__main__": main()
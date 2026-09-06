import sys, os, json, numpy as np
sys.stdout.reconfigure(encoding="utf-8")
import tensorflow as tf
exec(open("data/scripts/train_and_export.py").read().split("def main")[0])

CORPUS="data/corpus"; MODEL="data/model"
v=json.load(open(f"{MODEL}/vocab.json",encoding="utf-8"))
tk=Tok(v)

# GRU with static unroll -> TFLite compatible
class Munroll(M):
    def __init__(self, v):
        super().__init__(v)
        self.gru = tf.keras.layers.GRU(H, return_sequences=True, return_state=True, unroll=True)
base=Munroll(v)
base.build((None,25))
base.load_weights(f"{MODEL}/best.weights.h5")

class SingleStep(tf.keras.Model):
    def __init__(self, base):
        super().__init__(); self.base=base
    def call(self, src, prev):
        enc,st=self.base.gru(self.base.Eh(src))
        B=tf.shape(enc)[0]
        sW1=self.base.W1(st)[:,None,:]; hW2=self.base.W2(enc)
        emb=tf.squeeze(self.base.Es(prev), axis=1)
        e=tf.nn.softmax(self.base.V(tf.nn.tanh(sW1+hW2)),axis=1)
        ctx=tf.reduce_sum(e*enc,axis=1)
        o,[st]=self.base.cell(tf.concat([emb,ctx],-1),[st])
        return self.base.fc(o)

m=SingleStep(base)
X=np.array([[1]*25],dtype=np.int32); P=np.array([[0]],dtype=np.int32)
print("logits:", tuple(m(X,P).shape))

@tf.function(input_signature=[tf.TensorSpec([None,25],tf.int32), tf.TensorSpec([None,1],tf.int32)])
def infer(src, prev): return m(src, prev)
concrete=infer.get_concrete_function(tf.TensorSpec([None,25],tf.int32), tf.TensorSpec([None,1],tf.int32))
cv=tf.lite.TFLiteConverter.from_concrete_functions([concrete]); tfl=cv.convert()
open(f"{MODEL}/model.tflite","wb").write(tfl)
print("model.tflite:", round(os.path.getsize(f"{MODEL}/model.tflite")/1e6,2),"MB")
try:
    c8=tf.lite.TFLiteConverter.from_concrete_functions([concrete])
    c8.optimizations=[tf.lite.Optimize.DEFAULT]
    c8.representative_dataset=lambda: [ {"src": np.array([1]*25,dtype=np.int32), "prev": np.array([[0]],dtype=np.int32)} for _ in range(30)]
    c8.target_spec.supported_ops=[tf.lite.OpsSet.TFLITE_BUILTINS_INT8]
    c8.inference_input_type=tf.int8; c8.inference_output_type=tf.int8
    t8=c8.convert(); open(f"{MODEL}/model_int8.tflite","wb").write(t8)
    print("model_int8.tflite:", round(os.path.getsize(f"{MODEL}/model_int8.tflite")/1e6,2),"MB")
except Exception as e:
    print("int8 export skipped (best-effort):", type(e).__name__, str(e)[:200])
print("weights:", round(os.path.getsize(f'{MODEL}/best.weights.h5')/1e6,2),"MB")
print("files:", os.listdir(MODEL))
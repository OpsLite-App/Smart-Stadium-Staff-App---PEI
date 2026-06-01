import onnx
import numpy as np
from onnx import helper, TensorProto, numpy_helper

model = onnx.load("zip_n_model_quant.onnx")
graph = model.graph

# ── Constantes de normalização ──────────────────────────────────────────────
mean_vals = np.array([0.48145466, 0.4578275, 0.40821073], dtype=np.float32).reshape(1,3,1,1)
std_vals  = np.array([0.26862954, 0.26130258, 0.27577711], dtype=np.float32).reshape(1,3,1,1)
scale_val = np.array(1.0 / 255.0, dtype=np.float32)

# ── Initializers ─────────────────────────────────────────────────────────────
init_scale = numpy_helper.from_array(scale_val, name="pre_scale")
init_mean  = numpy_helper.from_array(mean_vals,  name="pre_mean")
init_std   = numpy_helper.from_array(std_vals,   name="pre_std")

graph.initializer.insert(0, init_scale)
graph.initializer.insert(1, init_mean)
graph.initializer.insert(2, init_std)

# ── Novo input: uint8 ─────────────────────────────────────────────────────────
old_input_name = graph.input[0].name  # "input"

new_input = helper.make_tensor_value_info(
    "input_u8", TensorProto.UINT8, [1, 3, 256, 256])

# ── Nós de preprocess ─────────────────────────────────────────────────────────
# Cast uint8 -> float32
cast_node = helper.make_node(
    "Cast",
    inputs=["input_u8"],
    outputs=["pre_float"],
    to=TensorProto.FLOAT,
    name="pre_cast"
)

# Divide por 255
div_node = helper.make_node(
    "Mul",
    inputs=["pre_float", "pre_scale"],
    outputs=["pre_div"],
    name="pre_div"
)

# Subtrai mean
sub_node = helper.make_node(
    "Sub",
    inputs=["pre_div", "pre_mean"],
    outputs=["pre_sub"],
    name="pre_sub"
)

# Divide por std
div_std_node = helper.make_node(
    "Div",
    inputs=["pre_sub", "pre_std"],
    outputs=[old_input_name],  # liga ao input original do modelo
    name="pre_div_std"
)

# ── Insere nós no início do grafo ─────────────────────────────────────────────
for i, node in enumerate([cast_node, div_node, sub_node, div_std_node]):
    graph.node.insert(i, node)

# ── Substitui o input do grafo ────────────────────────────────────────────────
graph.input.remove(graph.input[0])
graph.input.insert(0, new_input)

# ── Valida e guarda ───────────────────────────────────────────────────────────
onnx.checker.check_model(model)
onnx.save(model, "zip_with_norm.onnx")
print("✅ Guardado: zip_with_norm.onnx")

# ── Testa ─────────────────────────────────────────────────────────────────────
import onnxruntime as ort
sess = ort.InferenceSession("zip_with_norm.onnx")
dummy = np.random.randint(0, 255, (1, 3, 256, 256), dtype=np.uint8)
out = sess.run(None, {"input_u8": dummy})
print("Output shape:", out[0].shape)
print("Output sample:", out[0].flat[:4])
print("✅ Modelo com normalização funciona!")
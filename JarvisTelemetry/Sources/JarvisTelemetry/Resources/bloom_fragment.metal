#include <metal_stdlib>
using namespace metal;

fragment half4 bloom_fragment() {
    return half4(0.0, 0.8, 1.0, 1.0);
}

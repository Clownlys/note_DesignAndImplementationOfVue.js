// 依赖桶
const bucket = new Set()

// 原始数据
const data = {a:'hello world'}
let currentEffect
function effect(fn) {
    currentEffect = fn
    fn() // 执行副作用函数, 从而触发obj.a的读取操作, 从而将effect存入到obj.a的依赖中
}
// 对原始数据的代理
const proxyData = new Proxy(data, {
    get(target, key){
        // 依赖收集
        bucket.add(currentEffect)
        return target[key]
    },
    set(target, key, value){
        target[key] = value
        // 依赖触发
        bucket.forEach(fn => fn())
        // 返回true代表设置成功
        return true
    }
})
// 副作用函数
function any(){
    document.body.innerText = proxyData.a;
}

effect(any)
// 修改数据
setTimeout(() => {
    proxyData.a = 'hello vue'
}, 1000)


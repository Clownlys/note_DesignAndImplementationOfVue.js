// 依赖桶
const bucket = new Set()

// 原始数据
const data = {a:'hello world'}
// 对原始数据的代理
const proxyData = new Proxy(data, {
    get(target, key){
        // 依赖收集
        bucket.add(effect)
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
function effect(){
    document.body.innerText = proxyData.a;
}

effect()
// 修改数据
setTimeout(() => {
    proxyData.a = 'hello vue'
}, 1000)


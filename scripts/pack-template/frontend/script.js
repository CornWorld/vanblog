// Pack 前端脚本:以 <script type="module"> 注入每页(运行时,改文件即生效)。
// 顶层不能声明 const/function/let — 回调会被 PB executor VM 重新编译,
// 顶层变量不可见(此限制同样适用于 hooks/*.pb.js)。
console.log('[__NAME__] pack script loaded');

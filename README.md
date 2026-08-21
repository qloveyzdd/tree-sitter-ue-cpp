# tree-sitter-ue-cpp

仓库内使用的 Tree-sitter C++ 派生 grammar，为 Unreal Engine 声明宏、`_API` 标记、生成头路径和内联生成源路径提供明确语法节点，同时保持其他表达式宏为标准 C++ 调用表达式。

更新 grammar 后执行：

```powershell
npm ci
npm run generate
$env:TREE_SITTER_UE_CPP_FORCE_BUILD = "1"
python -m pip wheel .
```

Windows x64 的普通安装直接使用仓库内预构建的稳定 ABI 绑定；强制重建需要可用的 C11 编译器和 Python 开发头文件。

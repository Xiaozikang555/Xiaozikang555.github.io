# Xiaozikang555 的个人主页

简洁的中文个人主页，使用原生 HTML、CSS 和 JavaScript，适合 GitHub Pages。

## 预览

直接打开 index.html，或在此目录运行 `python -m http.server 8000` 后访问 http://localhost:8000。

## 修改内容

- index.html：介绍、作品和链接。
- styles.css：配色、布局和动效。
- script.js：页脚年份。

## GitHub Pages 发布

把文件上传到公开仓库 `Xiaozikang555.github.io` 的 main 分支。在仓库 Settings → Pages 中，选择 Deploy from a branch，分支 main，目录 / (root)，保存后等待部署。

网站地址：https://xiaozikang555.github.io/

## 生活相册

在网站点击「上传照片」，登录 GitHub 后向 photos 目录上传照片并 Commit changes。支持 JPG、PNG、WebP、GIF、AVIF。文件命名如 `2026-11-10_今天的晚霞.jpg`，相册自动识别日期和标题。照片公开展示。建议上传前压缩并移除不希望公开的定位等信息。

## 学习笔记

点击「写学习笔记」，在 GitHub 编辑器中写 Markdown 并 Commit changes。笔记保存在 notes 目录，命名如 `2026-11-10_学习主题.md`。主页自动列出笔记；点击阅读，阅读窗口提供编辑入口。阅读器支持一级至三级标题、简单列表和代码块；其他 Markdown 语法以文本显示。笔记公开展示。

相册和笔记目录由 GitHub Pages 内置 Jekyll 在发布时生成到 collections.json，避免依赖公共目录 API。请勿添加 .nojekyll 文件。上传或修改后等待 Pages 发布完成，再刷新相册或笔记。笔记原文和照片从 GitHub 原始文件地址读取。

## 备忘录

备忘录保存在当前浏览器 localStorage，可添加、完成、筛选、删除、导出文本。不会上传或跨设备同步；清除浏览器数据会删除备忘，请定期导出。


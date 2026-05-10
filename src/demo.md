# LiteSlide 终极演示
**极简且全能的 Markdown 渲染引擎**

按 `E` 唤起编辑 | 按 `M` 切换长文 | 按 `T` 切换日夜

## 1. 基础排版与样式
这是一段包含了**加粗**、*斜体*、~~删除线~~以及行内代码 `npm run dev` 的普通文本。

得益于 Tailwind v4 的强大生态，排版极其干净。

> 这是一个引用块（Blockquote）。
> 无论在白天还是黑夜模式下，它都会自动切换与之匹配的优雅背景色。

## 2. 智能分栏 (文本 + 单图)
当页面同时包含大量文本和一张图片时，引擎的大脑会自动触发 **Split-Right (左右分栏)** 布局。

左侧的文字会自适应宽度并**垂直居中**，右侧的图片会完美约束在屏幕安全区域内。这让你可以毫无心智负担地编写图文并茂的商业幻灯片。

![唯美风景](https://nju-aia.github.io/_astro/cat%20love%20Sticker%20by%20Capoo.Br25r3w7_b3clK.webp "山脉风景")

## 3. 智能画廊 (多图纯净段落)
下面是四个连续的图片节点（中间没有文字）。

它们会被底层的 `AstRenderer` 瞬间拦截，并强行转化为 **2x2 的画廊网格**，同时应用了 `object-cover` 裁切。无论原图是什么奇葩比例，在这里都会整齐划一！

![图1](https://images.unsplash.com/photo-1611162617474-5b21e879e113?auto=format&fit=crop&w=600&q=80)
![图2](https://images.unsplash.com/photo-1587620962725-abab7fe55159?auto=format&fit=crop&w=600&q=80)
![图3](https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=600&q=80)
![图4](https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80)

## 4. 极客专属 (公式与代码)
学术分享离不开代码与数学公式。这是标准正态分布的概率密度函数：

$$
f(x) = \frac{1}{\sqrt{2\pi}} e^{-\frac{x^2}{2}}
$$

下面配合 Shiki 的丝滑主题切换（现在按下键盘的 `T` 键试试）：

```typescript
function greet(name: string): string {
  // Shiki 会根据全局 isDark 状态
  // 在 github-light 和 tokyo-night 之间无缝热切！
  return `Hello, ${name}! Welcome to LiteSlide.`;
}
```

## 5. 超长内容分发测试
这一节我们要讲的内容非常多。首先这是第一页的引导语，我们在下面放置一张占位置的大图。

![测试图](https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80)

---

这已经是 PPT 的第二页了！

你会发现，在 Slide 模式下，这一页的顶部依然保留了“超长内容分发测试”的标题，保证了演讲的上下文不丢失。右边我们可以继续放代码或者别的图片。

```javascript
console.log("分页逻辑太爽了！");
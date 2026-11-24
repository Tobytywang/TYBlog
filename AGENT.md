# AGENT.md

给在本仓库工作的 AI 助手与协作者的约定与事实清单。动手前先读这里。

## 项目性质

纯静态个人主页（TYBlog）。无后端、无框架、无运行时依赖，产物是纯 HTML/CSS/JS。
所有 HTML 由 `src/` 下的模板与配置生成，**不要手改生成产物**。

## 站点配置（部署前必改）

`src/themes.json` 顶层有一项 `site`：

| 字段 | 说明 |
|---|---|
| `baseUrl` | 站点正式域名，**不带路径、不带末尾斜杠**。canonical / hreflang / sitemap / og:url 的绝对地址全部由它推出，别处不再出现域名 |
| `ogImage` | 分享卡片图，站内相对路径。文件不存在时构建直接报错——坏图在页面上看不出来，只能在这里挡 |

本仓库对外用两个域名：`tobyty.wang` 与 `lich.wang`。**部署前把 `baseUrl` 改成当前的主域，再 `npm run build`**；另一个域名作为别名被动跟随（canonical 会把它归并到主域）。换域名不需要动任何模板或脚本。

## 目录结构与职责

```
/
├── index.html              # 生成产物：默认入口（默认主题·中文）
├── robots.txt              # 生成产物：抓取规则 + sitemap 地址
├── sitemap.xml             # 生成产物：只收录默认主题的三种语言页
├── css/frame.css           # 共享布局（所有主题共用）
├── themes/<id>/            # 每个主题一个目录
│   ├── style.css           #   该主题的视觉样式
│   └── index*.html         #   生成产物：该主题的语言页
├── js/                     # i18n.js、background.js、solar-terms.js
├── img/                    # 背景图与清单（manifest.js 供页面、manifest.json 供加工脚本、source/ 为本地原图）
├── src/                    # ← 唯一可改目录
│   ├── template.html       #   页面模板
│   ├── partials/           #   按主题能力拼入模板的片段
│   │   └── keyboard-hint.html  #     快捷键提示条（仅背景切换主题）
│   ├── themes.json         #   站点配置 + 主题与语言配置
│   └── i18n.json           #   三语文案
├── bin/
│   ├── build.js            # 构建入口（npm run build）
│   ├── clean.js            # 清理产物（npm run clean）
│   ├── process_images.py   # 图片加工（npm run images，需 .venv）
│   └── lib/layout.js       # 布局规则单一事实来源，build 与 clean 共用
└── package.json            # 三个 npm 脚本
```

## 铁律

1. **只改 `src/`**。根目录与 `themes/` 下的 HTML 都是 `npm run build` 的产物，手改会被覆盖。
2. **改完必须重建**。改 `src/template.html`、`src/themes.json`、`src/i18n.json`、`themes/<id>/style.css` 后跑 `npm run build`，并确认生成的 HTML 确实变了。**图片增删只跑 `npm run images`**——页面读的 `img/manifest.js` 由它产出，构建不参与生成，因此不需要再重建。
3. **不要新建文档文件**（除本文件外）。需要沉淀知识时更新本文件，或追加到 `.workbuddy/memory/` 下的日志；不要擅自创建 README。
4. **不要擅自 push**。提交后停下，等用户明确要求再推远端。

## 常用命令

```bash
npm run build    # 生成全部页面 + robots.txt + sitemap.xml
npm run clean    # 清理产物（含陈旧页面与站点级文件）
npm run images   # 重新处理图片（需 .venv 存在）
```

## 添加一个新主题

三步，**不需要改任何构建脚本**：

**1. 建目录与样式表**：`themes/<id>/style.css`
样式表定义该主题的视觉变量（参考 `themes/retro/style.css`）。共享布局由 `css/frame.css` 提供，通常无需重复写。

**2. 在 `src/themes.json` 增加一项**：

```json
{
  "id": "dark",
  "dir": "themes/dark",
  "label": { "zh": "暗色", "en": "Dark", "fr": "Sombre" },
  "scripts": []
}
```

| 字段 | 说明 |
|---|---|
| `id` | 主题标识，唯一 |
| `dir` | 主题目录，页面与 `style.css` 都放这里（**真实生效**，改它产物目录跟着变） |
| `label` | 三种语言的显示名，**缺一个构建就报错** |
| `scripts` | 该主题额外加载的脚本。填 `["js/background.js"]` 即获得背景图切换 + 键盘快捷键 + 提示条；`img/manifest.js` 会自动排在其前，无需手写 |
| `default` | 可选，**有且仅有一个**主题带此标记，其中文页输出到根目录作为入口 |

**3. 构建**：`npm run build`

新主题会自动纳入右上角按钮的轮转循环（现代 → 复古 → 新主题 → 现代）。

## 添加一种语言

两步，**不需要改构建脚本**：

**1. `src/themes.json` 的 `pages` 增加一项**：

```json
{ "lang": "ja", "file": "index-ja.html", "label": "日本語" }
```

| 字段 | 说明 |
|---|---|
| `lang` | 语言标识，也是 `i18n.json` 的键 |
| `file` | 该语言的页面文件名 |
| `label` | 语言按钮上的文案（**必须**，缺失则构建报错） |

**2. `src/i18n.json` 补该语言的文案**，其中 `htmlLang` 同时决定 `<html lang>` 与 `hreflang`，两者同源，不要另写映射。

文案里 `navAria`、`hintAria`、`skinSwitchAria` 三键是页面属性用的，`skinSwitchAria` 内含 `{target}` / `{current}` 槽位，按各语言语序自己摆；**缺键会留下未替换的 `{{...}}`，构建直接报错**。

每个主题还需在自己的 `label` 里补上该语言的主题名，否则构建报错。

## 构建期校验规则

`bin/lib/layout.js` 的 `validate()` 在生成前检查，不通过则打印全部错误并 `exit 1`，**不会产出有问题的页面**。每个检查项的每个失败分支都独立报错（同一项可能有多条文案），清单如下：

- `site.baseUrl` 存在，且只是 `http(s)://主机名`（带路径或末尾斜杠都报错）
- `site.ogImage` 填了，且文件真实存在
- `skins` 不为空
- 主题 `id` 不重复
- 默认主题恰好一个（未指定、或指定了多个都报错）
- 每个主题都配了 `dir`
- 主题 `dir` 目录存在
- 主题目录下有 `style.css`
- 每个主题都有全部语言的 `label`
- 语言页文件名不重复
- 每个语言页都有按钮文案 `label`
- `sharedCss` / `sharedScripts` / 各主题 `scripts` 引用的文件都存在
- 有主题挂了背景脚本时，`img/manifest.js` 必须存在
- `img/manifest.json` 能解析
- `img/manifest.js` 必须覆盖 `img/manifest.json` 里的全部图片（少项即报「请重跑 npm run images」）

另有一处不在 `validate()` 内、但同样会中止构建：渲染后若页面里还有未替换的 `{{...}}`（典型原因是新语言漏了 i18n 键），整体失败且不落盘任何页面。

## 已知约定（改代码前务必了解）

- **默认主题的中文页输出到根目录** `index.html`；其余页面在 `themes/<id>/` 下。页面内所有链接用相对路径，由 `hrefTo()` 按层级自动计算 —— 不要手写 `../../`。
- **图片根目录**由 `<html data-img-base>` 注入（根页面 `img/`，主题页 `../../img/`），`js/background.js` 从中读取。脚本内**不设默认前缀**——任何单一前缀对其余层级的页面都是错的。
- **背景清单只有一个产生者**：`npm run images` 在写 `img/manifest.json` 的同一次运行里，额外写出 `img/manifest.js`（`self.__BG_MANIFEST__ = [...]`）。页面由构建注入 `<script src="img/manifest.js">`（见 `pageScripts()`，排在 `background.js` 之前），脚本只读这份数据，**不再 fetch**。原因：`file://` 下浏览器会拦截 `fetch`，外链 `script` 不受此限，因此双击打开同样有背景图；数据与清单同批产出，不存在「改完图忘了重建」的落后问题。`img/manifest.json` 只作图片脚本自己的增量状态，页面不读。
- **主题切换按钮**是 `<a class="skin-switcher">`，指向 `skins` 数组里的**下一个**主题（循环）。按钮样式在各主题的 `style.css` 中定义；`css/frame.css` 提供布局。
- **颜色分三个角色，不能混用**（现代主题每个节气都要三支都写）：`--color-primary` 只做填充面（卡头、选中胶囊、边框、描边），`--color-on-primary` 是填充面上的文字（对 primary ≥ 4.5:1），`--color-accent-text` 是白卡片上的链接/图标（对卡片底色 ≥ 4.5:1）。直接把 primary 当文字色用，浅灰、鹅黄、嫩绿这些节气会掉到 1.5:1 左右，字基本看不见。
- **键盘快捷键**：← → 切换背景、R 随机切换，**仅在加载了 `js/background.js` 的主题下生效**。这条同时决定提示条出不出：`hasBackgroundSwitch()` 为真的主题才把 `src/partials/keyboard-hint.html` 拼进页面，其余主题**根本没有这段 DOM**（不再靠 `display: none` 藏）。
- **站内链接**（语言导航、主题切换）统一从 `pageUrl(fromOutput, skin, page)` 出，不要在页面逻辑里再手拼 `outputPath` + `hrefTo`；**对外的绝对地址**（canonical / hreflang / `og:url` / sitemap）统一从 `absoluteUrl(config, path)` 出，域名只在 `site.baseUrl` 一处出现。
- **canonical / hreflang / sitemap 只认默认主题**：非默认主题的页面只是同一内容的另一套装扮，`canonicalPath()` 把它们归并到默认主题的同一语言页；hreflang 与 sitemap 同步只用这一套地址——若 hreflang 还指向自己那套、canonical 指向默认主题，两边会互相矛盾。新增语言时这里不用动，`config.pages` 一变三处一起变。
- **语言偏好**记在 `localStorage('lang')`：页面加载时按当前页的语言写入（页面本身就是偏好的事实来源，所以书签直接打开英文页也会被记住），再次访问中文页会自动跳到上次选择的语言。判断跳转必须读在写入之前，否则一写就把访客的选择覆盖成 zh。`?lang=` 参数**不再支持**——要指定语言就直接分享对应语言页的地址。
- **断点只写在 `css/frame.css` 末尾的响应式块里**（`min-width:768` / `min-width:1440` / `max-width:767`，另有一块 `max-width:374` 只管小屏字号）：`:root` 上的 `--tier`（`mobile` / `tablet` / `desktop`）与排版规则写在同一个媒体查询块内，改断点只改一处。块顺序必须从小到大——同一选择器后者胜，倒序会让 tablet 覆盖掉 desktop。`js/background.js` 只读 `--tier`，不要在 JS 里重写 768 / 1440。
- **卡片居中用 `body { display: flex }` + `.card { margin: auto }`**，不要改回绝对定位 + `translate(-50%, -50%)`：后者在视口比卡片矮时会把上半截裁掉且无法滚动。`.card .content p` 同理用 `min-height` 而不是 `height`，长文案换行时才不会压到下面的链接。小屏 `background-attachment` 单独改成 `scroll`，绕开 iOS Safari 对 `fixed` 的支持缺陷。
- **图片档位会去重**：原图长边小于某档时，`manifest.json` 里该档直接复用上一档的路径，不再落一份字节相同的副本（`process_images.py` 从大到小处理时判断）。档位参数集中在 `SIZES`，长边上限与体积上限同表，改档位只改这一处 —— 不要另写按长边推算的体积门槛。
- **原图比所有档位都小时**，三档共用同一个复制过来的原图文件，因此该文件可能超过小档的体积上限（例如 375px 的图 90KB > mobile 的 80KB）。这是有意的：三档本来就是同一张图，为了凑一个字节数去重编码同样的像素没有意义。
- **`img/source/` 不入库**（见 `.gitignore`），只保留在本地，是重新加工的质量源头；`npm run images` 需要它存在。派生产物（`desktop` / `tablet` / `mobile` + `manifest.json` + `manifest.js`）正常入库。

## 故意保留的「冗余」（审查时不要建议删除）

有些东西看着没有消费方，但**是为了让人能核对数据**，删掉只会让下次改动更容易出错。已明确保留：

- **`js/solar-terms.js` 的 `SOLAR_TERMS[].cn`**（24 条节气中文名）。代码只消费 `name` 和 `lng`，`cn` 没有任何引用。保留原因：调整黄经边界或新增节气时，人要靠它一眼核对「15° 是不是清明」。这是**数据与它的标签**，不是重复定义。
- **`js/background.js` 的 `preloadImage()`**（一行 `new Image()` 包装）。调用点读到的是「预加载下一张」这个意图，比裸写 `new Image().src = url` 清楚。

判断标准（区分「该收敛」与「该保留」）：

| 情形 | 处理 |
|---|---|
| 同一份事实存在多处，改一处会导致不一致（如背景清单曾经的三套口径、图片阈值与 `SIZES` 脱钩） | **收敛**，留下唯一事实来源 |
| 同一份事实有多种表达，只是为了让人读得懂（如 `cn` 标签、说明常量出处的对照表） | **保留**，不要以「未使用」为由删 |

## 提交规范

按功能拆分 commit，每个 commit message 写清「做了什么 + 为什么」。参考现有历史：

```
fix(solar-terms): 修复节气主题色在黄经 320°~355° 区间的误判
refactor(i18n): 语言切换改为真实页面导航，统一 URL/lang/hreflang
refactor(theme): 主题切换改为循环轮转，配置项去死并加构建期校验
```

改动跨多个紧密耦合文件时（模板 + 构建脚本 + 产物），放在同一个 commit，保证任一检查点都能正确重建。

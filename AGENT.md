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
│   ├── audit.js            # 体积体检（npm run audit；--range A..B 只查一段提交）
│   └── lib/layout.js       # 布局规则单一事实来源，build 与 clean 共用
├── .githooks/pre-commit    # 提交前拦截 >2 MB 的文件（npm run hooks / hooks:global）
├── .github/workflows/
│   ├── big-files.yml       # PR 上复查新增文件（第 4 层，防 --no-verify 逃逸）
│   └── delete-branch-on-close.yml  # 关闭未合并的 PR 时删分支（第 5 层）
└── package.json            # npm 脚本
```

## 铁律

1. **只改 `src/`**。根目录与 `themes/` 下的 HTML 都是 `npm run build` 的产物，手改会被覆盖。
2. **改完必须重建**。改 `src/template.html`、`src/themes.json`、`src/i18n.json`、`themes/<id>/style.css` 后跑 `npm run build`，并确认生成的 HTML 确实变了。**图片增删只跑 `npm run images`**——页面读的 `img/manifest.js` 由它产出，构建不参与生成，因此不需要再重建。
3. **不要新建文档文件**（除本文件外）。需要沉淀知识时更新本文件，或追加到 `.workbuddy/memory/` 下的日志；不要擅自创建 README。
4. **不要擅自 push**。提交后停下，等用户明确要求再推远端。

## 常用命令

```bash
npm run build        # 生成全部页面 + robots.txt + sitemap.xml
npm run clean        # 清理产物（含陈旧页面与站点级文件）
npm run images       # 重新处理图片（需 .venv 存在）
npm run hooks        # 提交前钩子，只装到本仓库
npm run hooks:global # 提交前钩子，装到全部仓库（每台机器一次）
npm run audit        # 体检历史体积，列出最大的文件
node bin/audit.js --range origin/master..HEAD   # 只查这段提交新增的文件（CI 用）
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
- **已知取舍：中文页跳转到记住的语言时，会先闪一下中文内容，这是有意保留的。** `js/i18n.js` 排在 `body` 末尾（它要读语言导航的 DOM），所以首帧可能已经画出中文。要彻底消除只能把判断挪进 `<head>` 同步执行，而那时 `<body>` 尚未解析，只能把「语言 → 本主题语言页 URL」的映射**再序列化一份**到 head（`hreflang` 不能拿来复用：它按 canonical 策略指向默认主题，复用会把复古主题的访客送进现代主题）。为一帧闪烁新增一处地址来源不划算，**不要再提议修它**。跳转本身用 `location.replace`，不留无意义的回退记录。
- **断点只写在 `css/frame.css` 末尾的响应式块里**（`min-width:768` / `min-width:1440` / `not all and (min-width:768)`，另有一块 `max-width:374` 只管小屏字号）：`:root` 上的 `--tier`（`mobile` / `tablet` / `desktop`）与排版规则写在同一个媒体查询块内。**768 在「平板起」与「手机」两块各出现一次**，是同一断点的两面，改断点必须同步改这两处——CSS 媒体查询不能引用变量，做不到真正的一处；两块共用同一个 768（而不写成 768 / 767）是为了不用心算补一，且 `not all and` 与 `min-width` 严格互补，不会在半像素宽度上两块都不匹配。块顺序必须从小到大——同一选择器后者胜，倒序会让 tablet 覆盖掉 desktop。`js/background.js` 只读 `--tier`，不要在 JS 里重写 768 / 1440。
- **卡片居中用 `body { display: flex }` + `.card { margin: auto }`**，不要改回绝对定位 + `translate(-50%, -50%)`：后者在视口比卡片矮时会把上半截裁掉且无法滚动。`.card .content p` 同理用 `min-height` 而不是 `height`，长文案换行时才不会压到下面的链接。小屏 `background-attachment` 单独改成 `scroll`，绕开 iOS Safari 对 `fixed` 的支持缺陷。
- **卡片标题是全页唯一的 `<h1>`**（`src/template.html`，样式在 `frame.css` 的 `.card .header h1`）。原先用 `<p>`，整页没有任何标题标签，搜索引擎与读屏器都拿不到标题层级；`font-weight: inherit` 用来抵消 h1 的默认加粗，保持原观感。改模板时不要把这条选择器漏掉，否则字号与字重会跳变。语言导航的当前项带 `aria-current="page"`——「当前是哪种语言」不能只靠 `.active` 的视觉样式传达。
- **图片档位会去重**：原图长边小于某档时，`manifest.json` 里该档直接复用上一档的路径，不再落一份字节相同的副本（`process_images.py` 从大到小处理时判断）。档位参数集中在 `SIZES`，长边上限与体积上限同表，改档位只改这一处 —— 不要另写按长边推算的体积门槛。
- **原图比所有档位都小时**，三档共用同一个复制过来的原图文件，因此该文件可能超过小档的体积上限（例如 375px 的图 90KB > mobile 的 80KB）。这是有意的：三档本来就是同一张图，为了凑一个字节数去重编码同样的像素没有意义。
- **`img/source/` 不入库**（见 `.gitignore`），只保留在本地，是重新加工的质量源头；`npm run images` 需要它存在。派生产物（`desktop` / `tablet` / `mobile` + `manifest.json` + `manifest.js`）正常入库。

## 大文件防线（完整方案）

### 为什么要这么多层

两个 git 事实决定了这件事的难度：

1. **历史不可变。** 文件一旦被提交，就不再存在「删掉它」的操作——只能重写全部后代提交，让它们换哈希，然后所有已有副本变成分叉。
2. **`clone` 拉取全部分支**（`refs/heads/*`），不只是默认分支。所以哪怕文件只存在于一个没合并的个人分支上，每次全新 clone 也要为它付带宽。

推论：**越早拦，修复成本越低**。在提交前拦是 0 成本；进了 master 只能重写历史并协调所有副本。整个方案就是把闸门尽量往前放，并在漏掉时把损失关在「删一个分支」的范围内。

### 五层闸门

| # | 位置 | 生效条件 | 挡住什么 | 失效后果 |
|---|---|---|---|---|
| 1 | `.gitignore` | 随仓库走 | 压根不该 add 的素材区（`img/source/`） | — |
| 2 | `.githooks/pre-commit` | `npm run hooks` | 暂存区里 >2 MB 的文件，仅本仓库 | 对象被创建 |
| 3 | `~/.config/git/hooks/pre-commit` | `npm run hooks:global` | 同上，**全部仓库**；换机器装一次 | 同上 |
| 4 | `.github/workflows/big-files.yml` + 必需检查 | PR + 规则集 | 逃过钩子的提交，**在合并进 master 之前** | 进 master，永久 |
| 5 | `.github/workflows/delete-branch-on-close.yml` | PR 被关闭（未合并） | 被第 4 层拦下的那个分支（含大文件）继续存活 | 每次 clone 都付费 |
| — | `npm run audit` | 手动 | 只**发现**已经进历史的东西 | — |

第 4 层是唯一的服务端关卡，也是唯一能在「合并前」说不的环节；第 5 层是它的清道夫。**两者缺一，成本都会弹回去**：没有第 4 层，删分支来不及；没有第 5 层，含大文件的分支会一直留着。

**只有「关闭未合并」的分支才需要专门处理。** 合并掉的分支里不可能有大文件（否则第 4 层不会让它合并），留着也只占几 KB，属于整洁问题、不属于防线。因此 `delete_branch_on_merge` 不在防线上，想开就开，与主线无关。

**盲区**：从没开过 PR 的野分支。它不触发第 5 层，也没有检查拦过，只能靠第 1～3 层。单人仓库接受这个风险；多人协作则应加定期扫分支的定时任务。

### 各层要点

**第 1 层 · `.gitignore`**
定性：**源片不进库，只进加工产物**。原片放 `img/source/` + 本地备份，`npm run images` 随时能重跑。判断标准不是「文件多大」，而是「能不能从别处重新生成」。

**第 2 / 3 层 · 本地钩子（同一份脚本）**
`npm run hooks:global` 把 `.githooks/pre-commit` 复制到全局目录并设 `core.hooksPath`。不要另写一份——两份实现必然漂移。

- 本仓库本地已设 `core.hooksPath=.githooks`，**本地优先于全局**；全新 clone 没这条配置，直接落到全局那层。两条路都能拦，没有空档。
- `core.hooksPath` 是机器级配置，不会随仓库走。**换电脑要跑一次 `npm run hooks:global`**（或在 dotfiles 里带上 `~/.config/git/hooks/`）。git 出于安全不允许 clone 时自动执行代码，所以「零步骤」在客户端不可能，上限是「每台机器一次」。
- 阈值与开关走 git config，两种装法共用：`hooks.bigFiles.limitMb`（默认 2）、`hooks.bigFiles.enabled`（`false` 关闭）。某个仓库确实要存大文件时用 `git config --local` 覆盖，不要动全局。
- 全局生效时**先执行仓库原有的 `.git/hooks/pre-commit`**（存在且非软链时），避免把人家的钩子静默废掉。
- `git commit --no-verify` 是逃生阀。真要用，先想清楚是不是该走 `img/source/` + 本地备份。
- 阈值 2 MB 的依据：现有最大派生产物是 0.77 MB 的 `img/bg03.jpg`，留 2.5 倍余量。**不要为了「这次特殊」调高阈值**——调高等于把防线往后挪。

**第 4 层 · PR 闸门（为什么是 PR 而不是 push）**
GitHub 上能「在推送时拒收」的服务端能力只有 **push ruleset**（限制文件大小/扩展名/路径），而它**只对 private / internal 仓库开放（Team 及以上）**。本仓库是 public，拿不到；Actions 又只在推送**成功之后**才跑，对直推分支只能事后报警。

所以改用另一条路：本仓库有 `master-protect` 规则集（禁止直推、禁止 force push、要求走 PR、要求线性历史、**绕过名单为空**），所有改动必然先停在 PR 分支上——在 PR 阶段拦下，坏提交就永远进不了 master。

- **这条规则集是第 4 层成立的前提，不要删，也不要往绕过名单里加人。**
- 检查逻辑不另写：`node bin/audit.js --range "origin/<base>..HEAD"`，复用同一个 `LIMIT_MB`，避免出现第三份「2 MB」。
- 它还需要在规则集里被设为 **required status check**，否则红着也能合并。
- 副作用：`master-protect` 禁止 force push，所以「重写历史后强制推送」会被远端拒绝。真要重写，必须临时停用该规则集，推完再启用。

**第 5 层 · 关闭未合并时删分支**

- `delete-branch-on-close.yml` 管的就是「第 4 层拦下之后，那个分支怎么办」：PR 被关闭、未合并时删掉源分支。GitHub 不管这种情况，没有它，含大文件的分支会一直留着，每次 clone 都要付费。
- 只处理同仓库的分支（`head.repo.full_name == github.repository`）：fork 来的分支不在本仓库，删不了也不该删。
- 实测（用 `file://` 走真实协议；用本地路径 clone 会直接拷对象库，测不出真相）：4 MB 分支存在时 clone 为 4216 KB，删掉分支后降为 120 KB，对象从传输清单里彻底消失。
- **残留**：开过 PR 的提交，`refs/pull/N/head` 会一直指着它，删分支也不消失。默认 clone 不拉这个 ref（不占带宽），但 `git fetch origin refs/pull/N/head` 仍能完整取回内容。所以**删分支解决的是带宽，不是「当它没存在过」**。
- GitHub 对不可达对象不会立刻物理删除，按 SHA 仍可能访问一段时间；要彻底清除得联系 Support。这部分不可控，只能靠「别推上去」。

### 当前状态

已就绪：第 1、2、3 层（含全局安装），第 4、5 层的 workflow 已推到 `origin/master` 且 `state=active`，`npm run audit` 退出码 0。

剩下的唯一待办：

- [ ] 跑通一次 PR，让 `大文件检查` 出现在检查列表，然后设为 `master-protect` 的 required status check

**这一步不能提前做**：检查名要先在 GitHub 上跑过一次才会出现在可选列表里，提前加会让之后所有 PR 卡在 `Expected — waiting for status to be reported`。

可选（与防线无关）：打开 `delete_branch_on_merge`，省得合并后手动删分支。

### 怎么验证防线还在

```bash
# 1) 历史体检：退出码 1 说明历史里还有超限文件
npm run audit

# 2) 钩子是否装好（全局 / 本仓库）
git config --global --get core.hooksPath
git config --local  --get core.hooksPath

# 3) 手工造一个超限文件，确认提交被拒（记得事后清理）
dd if=/dev/urandom of=/tmp/big.bin bs=1024 count=3000 && cp /tmp/big.bin img/ \
  && git add img/big.bin && git commit -m test   # 期望：✋ 提交被拦截
git reset -q HEAD img/big.bin && rm -f img/big.bin
```

### 旧账已清理（2026-11-24，可作为以后重写的操作备忘）

`img/source/DSCF0106.JPG`（14.22 MB，占仓库体积 65%）已从历史中摘除。做法与验收：

1. `git bundle create ~/TYBlog-backup-<时间戳>.bundle --all`（22 MB，`git bundle verify` 通过）
2. 临时停用 `master-protect`（`non_fast_forward` 会挡住 force push），推完立刻重新启用
3. `FILTER_BRANCH_SQUELCH_WARNING=1 git filter-branch --index-filter 'git rm -r --cached --ignore-unmatch --quiet "source/DSCF0106.JPG" "img/source/DSCF0106.JPG"' --prune-empty -- --all`
4. `rm -rf .git-rewrite`、删 `refs/original/*`、`git reflog expire --expire=now --all`、`git gc --prune=now`
5. force push；服务器那份 clone 必须重新 clone（或 `fetch && reset --hard`），旧副本会分叉
6. 验收：`npm run audit` 退出码 1 → 0；`.git` 37 MB → 8.0 MB

**验收时最该看的一行是 `HEAD^{tree}` 哈希在重写前后必须相等**（这里是 `0a36adb9`）。树哈希等于「当前全部文件内容」的指纹，相等就证明内容零损失、历史里少的只有那个 blob。另外三项：`git ls-tree -r HEAD` 清单 diff 一致、`git fsck` 无输出、`clean && build` 后工作区零变更。

**外部验证必须走真实协议**：从 GitHub 全新 clone 一份，体积 8.0 MB、`git cat-file -e <blob>` 取不到，才算真的不再付带宽。用本地路径 clone 会直接拷对象库、绕开传输协议，测不出真相；GitHub API 的 `size` 字段是缓存值，同样不能当证据。

现在 `audit` 从 0 起算，它从「永远红的旧账」变成了真正的回归闸门——变红就一定是新增的大文件。

### 不是防线的东西

- **GitHub 单文件 100 MB 硬拦截**：最后兜底，触发时文件已经在传输列表里了。
- **Git LFS**：只是把大文件挪到别处，还多了服务端额度和依赖。该 ignore 的东西就 ignore。
- **「事后删分支」当唯一方案**：它依赖人记得，而且只能救没合并的。它的正确定位是第 4 层的清道夫。


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

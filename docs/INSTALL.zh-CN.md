# 详细安装与本地部署说明

## A. 直接安装 Chrome 插件（不用配置开发环境）

1. 打开 [Sunny Kart 下载页](https://github.com/X-mOtion/sunny-kart-motion-break/releases/latest)。
2. 在 **Assets** 下下载 `SunnyKart-Chrome-extension.zip`。要玩插件就下载这个文件；GitHub 自动提供的 **Source code (zip)** 是源码，需要自己构建。
3. 把 ZIP 解压到长期保存的位置，例如文档目录中的 `SunnyKart`。解压后找到 `SunnyKart-Chrome` 文件夹，打开应能看见 `manifest.json`、`index.html`、`icons`、`pose` 等文件。
4. 打开 Chrome，在地址栏输入 `chrome://extensions` 并回车。
5. 打开右上角 **开发者模式 / Developer mode**。
6. 点击 **加载已解压的扩展程序 / Load unpacked**，选择刚才含 `manifest.json` 的 `SunnyKart-Chrome` 文件夹。不要选择 ZIP，不要选择它的外层目录。
7. 安装成功后，列表显示 **Sunny Kart - Motion Break**。点击浏览器工具栏的拼图图标，把游戏固定到工具栏。
8. 点击黄色赛车图标，会打开完整游戏标签页。再次点击会回到已有的游戏。
9. 选择一张地图。默认 **Motion**，点击 **Let us cruise** 后允许摄像头。也可以先选 **Keyboard** 试玩。

插件包含本地识别模型，不用额外下载，也不用运行 localhost 服务。请保留解压后的文件夹。更新时关闭游戏，在原目录替换文件，再到 `chrome://extensions` 点击插件的 **重新加载**。

这是 GitHub 提供的本地安装方式，与 Chrome 商店审核进度无关。官方流程参考：[Load an unpacked extension](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked)。

## B. 从源码运行（Mac、Windows、Linux）

### 1. 安装 Node.js

从 [Node.js 官网](https://nodejs.org/en/download) 安装 **22.12 或更新版本**。使用适合系统的安装包并保留默认 npm 选项。Mac 的 Apple 芯片可使用 arm64 安装包。

安装后关闭并重新打开终端，输入：

```sh
node --version
npm --version
```

应分别显示版本号。如果提示找不到命令，先完成 Node.js 安装或重新打开终端，再继续。

Windows 建议使用 **命令提示符 / Command Prompt** 执行这些命令；遇到 PowerShell 的脚本执行限制时，可以改用 `npm.cmd`，例如 `npm.cmd ci`。

### 2. 下载源码

安装了 Git 的用户：

```sh
git clone https://github.com/X-mOtion/sunny-kart-motion-break.git
cd sunny-kart-motion-break
```

不使用 Git 的用户：仓库页面点击 **Code → Download ZIP**，解压后进入目录。在该目录打开终端；目录中应直接看到 `package.json`、`src/` 和 `public/`。

### 3. 安装依赖

```sh
npm ci
```

首次需要联网，下载 npm 依赖。请等命令正常结束再启动游戏。本仓库已经附带游戏素材、识别模型和许可文件；无需另找 KartAssets，也无需安装 Python、Blender、Unity 或申请 API Key。

### 4. 开发模式

```sh
npm run dev
```

打开终端提示的地址，默认 **http://localhost:5173/**。如果默认端口已被占用，Vite 会显示实际端口。修改源码后浏览器会自动更新。

服务运行时终端需要保持开启。结束时按 **Ctrl + C**。以后再次运行只需进入同一目录执行 `npm run dev`。

### 5. 正式本地模式

```sh
npm run build
npm start
```

打开终端显示的地址，默认 **http://localhost:4173/**。端口被占用时自动改为后续端口。不需要保持开发工具运行，但需要保持这个本地服务开启。

也可以双击 Mac 的 **启动游戏.command** 或 Windows 的 **Start Sunny Kart.cmd**。首次缺少依赖时会自动安装，随后构建并打开浏览器。Node.js 仍需提前安装。

### 6. 开启体感

1. 用 Chrome 打开上面的 **localhost** 地址。
2. 首页选择 **Motion** 和地图，点击 **Let us cruise**。
3. 浏览器询问摄像头权限时选择 **允许 / Allow**。
4. 自然坐直，看向屏幕，让脸部和双肩完整入镜，保持正常放松姿势即可自动适配并进入倒计时。
5. 若有多个摄像头，可以在连接页面或暂停菜单的 **Change camera** 选择设备。
6. 歪头变道、倾肩转弯、双肩轻耸加速。每次动作后回正，再做下一次。

Mac 若相机无法使用：系统设置 → 隐私与安全性 → 摄像头，允许 Chrome，再重新打开 Chrome。Windows 检查设置 → 隐私和安全性 → 摄像头，以及允许桌面应用访问摄像头。

游戏会释放退出体感模式后的相机。画面只在本机识别，不上传、不保存录像。首次进入体感需要初始化约 43 MiB 的本地识别资源，耐心等待连接完成，避免反复点击。

## C. 用源码生成 Chrome 插件

先执行 `npm ci`，然后：

```sh
npm run build:extension
```

命令会自动构建游戏并生成 `release/SunnyKart-Chrome/`。按照 A 部分的第 4～9 步，加载这个文件夹即可。

如果要给别人发送安装包：

```sh
npm run package
```

生成的 `release/SunnyKart-Chrome-extension.zip` 可以直接提供给别人解压安装。它包含 MIT 代码许可和全部第三方素材署名。

## D. 使用已经构建好的网页版 ZIP

1. 在 Releases 下载 `SunnyKart-web.zip`，解压。
2. 终端进入解压文件夹；应直接看到 `dist/`、`scripts/`、`package.json` 和启动文件。
3. 提前安装 Node.js 后，执行 `npm start`，打开终端显示的 localhost 地址。这个包无需 `npm ci`，也无需重新构建。
4. 也可双击随包附带的 Mac 或 Windows 启动文件。

不要直接双击 HTML 文件；文件协议无法正常加载模型和识别资源。

## E. 部署到静态网站

源码运行 `npm run build` 后，将 `dist/` 的全部内容上传到静态网站服务。构建包内的 HTML、JavaScript、CSS、assets、pose、licenses、CREDITS.md 都要保留。

- 公开体感网站必须使用 **HTTPS**。
- 本机 `http://localhost` 属于可用的摄像头环境。
- `http://192.168.x.x` 等普通局域网 HTTP 地址通常不允许调用摄像头，不能用它替代 localhost 进行电脑体感驾驶。
- 项目无需后端和数据库，网站服务器需要正确提供 `.wasm` 文件；推荐 MIME 类型 `application/wasm`。
- Chrome 插件直接加载本地模型，无需部署网站。

## 常见问题

| 问题 | 处理方式 |
|---|---|
| `node` / `npm` 找不到 | 安装 Node.js，并重新打开终端 |
| PowerShell 拒绝执行 npm 脚本 | 用命令提示符，或执行 `npm.cmd ci`、`npm.cmd run dev` |
| `npm ci` 报错 | 确认在含 `package.json` 的目录、Node 版本满足要求，检查网络后重新执行；保留仓库的 package-lock.json |
| 页面打不开 | 确认服务终端还在运行，并使用终端实际显示的端口 |
| 相机权限被拒绝 | Chrome 网站权限中恢复摄像头为允许，并检查操作系统权限 |
| 相机被占用 | 关闭其他相机应用，回游戏点击 Reconnect；也可先选 Keyboard |
| 体感动作漏判 | 改善光照，让脸部和双肩清晰可见，在 Settings 中调整灵敏度，先用 Gesture practice 练习 |
| 动作一直保持却不重复 | 这是单次动作规则；先回正或放松，再执行下一次 |
| 画面卡顿 | Settings → Graphics 选 Performance，关闭其他占用显卡的程序，检查 Chrome 的图形加速 |
| 插件加载失败 | 选中直接包含 manifest.json 的文件夹，而不是 ZIP 或外层目录 |
| 更新后仍是旧版 | 在 chrome://extensions 重新加载插件，再关闭并重新打开游戏标签页 |

设置和成绩保存在浏览器本地。localhost、插件和部署网站分别使用各自存储，不会自动互相迁移。

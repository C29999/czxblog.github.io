# Blog 私有访问统计

后台地址：统计服务域名下的 `/blog/`。页面、资源和数据接口均由服务端检查 IP；**未配置或错误配置白名单时默认拒绝访问，并停止采集**。后台 HTML 位于 `netlify/private/`，不会生成到 GitHub Pages 的 `public/` 目录中。

## 当前部署边界

GitHub Pages 只能托管静态页面，不能执行本项目的 Netlify Functions。因此仅推送 GitHub 仓库还不能启用本统计后台，需要一个已部署此仓库的 Netlify 站点。

支持两种方式：

1. 整个博客由 Netlify 托管。使用仓库内 `netlify.toml`：构建 `npm run build`，发布目录 `public`，函数目录 `netlify/functions`。生产构建从 Netlify 的 `URL` 自动设置统计服务地址。
2. 保留 GitHub Pages 博客，另用 Netlify 托管同一仓库的统计服务。GitHub Pages **生成网站时**设置 `BLOG_ANALYTICS_ORIGIN=https://你的站点.netlify.app`，Netlify **函数环境**设置 `BLOG_ALLOWED_ORIGINS=https://c29999.github.io`（精确 origin，不带路径、结尾斜线）。后台仍需从 `https://你的站点.netlify.app/blog/` 访问。

不能把实际访客 IP 或白名单写进前端脚本；也不能在 GitHub Pages 里用 JS 隐藏后台来代替服务端授权。

## 首次启用

1. 在 Netlify 中导入本仓库，按上面的构建配置发布。可先不填白名单，后台和采集将保持关闭。
2. 用你平时访问博客的浏览器打开该 Netlify 站点的 `/api/blog/ip`。它只返回当前请求的公网 IP，响应不缓存。不要用本机局域网 IP，终端代理与浏览器代理不同也可能导致出口 IP 不同。
3. 在 Netlify 的生产 Functions 环境变量中设置 `BLOG_OWNER_IPS`，例如 `203.0.113.10,2001:db8::10`。**示例为文档地址，不能原样使用。** 支持多个精确 IPv4/IPv6，以逗号或空白分隔；不接受 CIDR。变量只需设置在生产环境，不要让公开预览部署共用生产白名单。
4. 保存后重新部署，使函数读到新配置。用同一浏览器访问 `/blog/`；用手机移动数据测试，后台及 `/api/blog/stats` 应返回 403。
5. 自己访问和点击博客后，统计应保持不变；其他网络的正常浏览应产生记录。对于 GitHub Pages，另需带上 `BLOG_ANALYTICS_ORIGIN` 重新生成并发布静态站点。

同一个公网 IP 后的设备都会获得访问权，并都会被排除统计。IP 不是设备身份凭证。公网 IP 变化时，先访问 `/api/blog/ip`，再更新变量、重新部署。若曾使用过多个出口，保留旧 IP 也能在报表中排除其已有记录。若必须精确到某一台电脑，需要另加登录或设备验证。

## 统计口径

- 页面加载、浏览器返回缓存恢复，以及启用 PJAX 后的页面切换计作浏览。脚本注入覆盖主题页面和 `skip_render` 的独立 HTML 页面，使用相对脚本路径以支持项目子目录。
- 点击统计 HTTP(S) 链接，以及有 `id` / `data-analytics-id` 的按钮；忽略表单内元素、标记了 `data-analytics-ignore` 的内容及合成点击。400ms 内同一目标重复点击去重。没有可识别 ID 的按钮不计入。
- 存储真实公网 IP、北京时间日期、次数、页面路径、点击目标、首次/最近访问时间；不收集查询参数、锚点、表单值、链接文本或位置定位。按钮需要显式安全 ID，避免将输入值用作 ID。
- UV 显示为“独立访客 IP”，并非独立人数。共享网络、代理、动态 IP、脚本屏蔽及机器人均可能影响数据；统计接口也无法保证请求一定来自真人。
- 当前白名单 IP 在写入前排除；查询时再次排除，已有原始记录按保留期清理。
- 已关闭不蒜子计数，避免另一套计数继续统计自己。不迁移旧的不蒜子数据，也无法准确删除其中的历史自访。
- 记录保留最近 90 个北京时间自然日，每天 04:20 通过 Netlify Scheduled Function 清理过期日。定时任务需在 Netlify 生产环境验证执行情况；停用站点或定时任务后清理也会停止。
- 每 IP 每日一个 Netlify Blobs 文档。强一致性读取、版本条件写入并发重试、最近 128 个事件 ID 去重；每 IP 每分钟最多 120 个事件。每 IP 每日保留最多 200 个页面及 200 个点击目标，超额明细不再记录但总量保留，后台会提示。
- 后台支持今天 / 7 / 30 / 90 天；最多读取 5000 条访客日记录，超出时要求缩小时间范围，绝不展示截断后的总数。排行最多 100 项，访客表可搜索和翻页。一次查询并非所有文档的事务快照，实时写入期间刷新可能看到少量差异。
- 使用浏览器 `fetch`，失败不影响阅读；网络断开、请求拦截或服务限流会造成漏计。Netlify Blobs 用量取决于流量，管理后台按需刷新。

## 验证和本地预览

```powershell
npm run test:analytics
npm run build
npm run preview:analytics
```

预览位于 `http://127.0.0.1:4322/blog/`，仅绑定本机回环地址，使用明确标记的虚构数据，内存存储不会接触线上访客。生产函数不引用此预览程序。

无部署配置的本地 / GitHub Pages 构建默认不注入统计脚本，构建日志会提示 disabled。可用下面的命令验证所有 HTML 的注入（设置真实后端地址后再实际发布）：

```powershell
$env:BLOG_ANALYTICS_ORIGIN = 'https://你的站点.netlify.app'
npm run build
Remove-Item Env:BLOG_ANALYTICS_ORIGIN
```

## 技术资料

- Netlify Functions `context.ip`：https://docs.netlify.com/build/functions/api/
- Netlify Blobs 强一致性和条件写入：https://docs.netlify.com/build/data-and-storage/netlify-blobs/
- GitHub Pages 静态托管：https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages

不要从请求的 `X-Forwarded-For`、`CF-Connecting-IP` 等任意头部决定管理员权限。部署后必须实际验证平台提供的 `context.ip`、私有资源打包以及定时任务；单元测试不能替代线上校验。

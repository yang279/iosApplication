# Kapture

自定义拍照 / 录像应用。React Native (Expo) 构建，专为 **Windows 上开发 + iPhone 侧载安装** 的工作流设计。

## 功能

- 相机预览、拍照、录像（含音频）
- 拍照 / 录像模式切换
- 前后摄像头切换
- 闪光灯（关 / 自动 / 开）、手电筒
- 后置多镜头切换（超广 / 广角 / 长焦，需设备支持，如 iPhone 15 Pro Max）
- 拍摄后自动保存到系统相册
- 最近拍摄预览

## 环境要求（Windows 开发机）

- Node.js LTS + npm
- Git
- 一部 iPhone（装 Expo Go 用于日常调试）
- 免费 Apple ID（需开启双重认证，用于签名安装）

## 日常开发循环（热重载，无需签名）

1. iPhone 在 App Store 安装 **Expo Go**（若中国区搜不到，见下方"故障排查"）
2. 启动开发服务器：

   ```
   npx expo start
   ```

3. 手机与电脑连同一 Wi-Fi，用 Expo Go 扫终端里的二维码 → 应用直接在手机上运行，改代码即时热重载
4. 局域网被隔离（公司 / 校园网）时改用隧道模式：

   ```
   npx expo start --tunnel
   ```

注意：日常调试用 Expo Go 就能覆盖相机、录像、保存相册等全部功能；7 天签名限制只影响下面"正式安装"的构建。

## 构建正式版 IPA（GitHub Actions，无需 Mac）

1. 把本仓库推送到 GitHub（**建议公开仓库**：macOS runner 无限免费；私有仓库免费额度约只够每月 15 次构建）
2. 每次 push 到 `main`，或手动到仓库 **Actions → iOS unsigned IPA → Run workflow**
3. 构建约 15~25 分钟，完成后在该次运行页面底部 **Artifacts** 下载 `Kapture-unsigned-ipa`（解压得到 `Kapture-unsigned.ipa`，未签名）

## 签名并安装到 iPhone（免费 Apple ID）

用爱思助手或 Sideloadly 把未签名 ipa 签名后装入手机（二选一）：

- **爱思助手**：工具箱 → IPA 签名 → 使用 Apple ID 签名 → 选 `Kapture-unsigned.ipa` → 签名后通过 USB 安装
- **Sideloadly**（[sideloadly.io](https://sideloadly.io)）：拖入 ipa → 填 Apple ID 和密码 → 双重认证验证码 → Install

### 免费 Apple ID 的限制（必读）

| 限制 | 说明 |
|---|---|
| 7 天过期 | 签名 7 天后应用打不开，连电脑用同一 ipa **重新签名安装**即可（无需重新构建） |
| 3 个应用 | 同一 Apple ID 最多同时侧载 3 个应用 |
| 10 个 App ID | 每周最多注册 10 个新的 bundle ID，**所以本项目 bundle ID `com.han.kapture` 已锁定，不要改** |

## 7 天续签

拿上一次下载的 `Kapture-unsigned.ipa`，重复"签名并安装"步骤即可，不需要重新跑 CI。

## 故障排查

- **Expo Go 中国区搜不到**：换一个非中国区 Apple ID 下载一次即可（之后换回原账号也能用）；或放弃热重载循环，全部走 CI 构建验证
- **爱思 / Sideloadly 装不上 / 不识别设备**：先装 Apple 驱动（爱思助手一般会自动装）
- **签名报错**：确认 Apple ID 已开启双重认证；密码错几次后先在网页登录 Apple ID 再试
- **相机黑屏**：系统设置里给应用（Expo Go 或 Kapture）开了相机权限

## 项目结构

```
App.tsx                       相机主界面（MVP 单屏）
app.json                      应用配置：bundle ID、权限文案、原生插件
.github/workflows/build-ipa.yml  云端构建未签名 IPA
```

## Roadmap

- **P2**：变焦滑杆、网格线、自拍倒计时、应用内相册、视频播放预览（expo-video）
- **P3**：实时滤镜（frame processor）、RAW / ProRes、参数调节（ISO / 快门）

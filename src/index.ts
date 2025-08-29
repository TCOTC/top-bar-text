import {
    Plugin,
    Setting,
    getFrontend,
} from "siyuan";
import "./index.scss";

const STORAGE_NAME = "top-bar-text-config.json";

// 原始代码片段：https://ld246.com/article/1728048965009
export default class TopBarTextPlugin extends Plugin {
    private isMobile: boolean;
    private topbarDragElement: HTMLElement;
    private accountMenuElement: HTMLElement;
    
    async onload() {
        const frontEnd = getFrontend();
        this.isMobile = frontEnd === "mobile" || frontEnd === "browser-mobile";
        // 加载配置
        await this.loadData(STORAGE_NAME);
        // 默认配置
        this.data[STORAGE_NAME] ||= {}; // 默认是空字符串，所以用 ||? 而不是 ??=
        this.data[STORAGE_NAME].topbarRightCountdown ??= {};
        this.data[STORAGE_NAME].topbarRightCountdown.template ??= '示例：距离 <span style="color: red;">${text}</span> 剩余 ${countdown} 天'; // 顶栏右侧倒计时模板 // TODO: i18n
        this.data[STORAGE_NAME].topbarRightCountdown.text ??= "2100年"; // 顶栏右侧倒计时文本
        this.data[STORAGE_NAME].topbarRightCountdown.targetTime ??= "2100-01-01"; // 顶栏右侧倒计时时间
        this.data[STORAGE_NAME].topbarLeftCountdown ??= {};
        this.data[STORAGE_NAME].topbarLeftCountdown.template ??= '示例：距离 <span style="color: red;">${text}</span> 剩余 ${countdown} 天'; // 顶栏左侧倒计时模板
        this.data[STORAGE_NAME].topbarLeftCountdown.text ??= "2100年"; // 顶栏左侧倒计时文本
        this.data[STORAGE_NAME].topbarLeftCountdown.targetTime ??= "2100-01-01"; // 顶栏左侧倒计时时间
        this.data[STORAGE_NAME].mobileRightCountdown ??= {};
        this.data[STORAGE_NAME].mobileRightCountdown.template ??= '示例：距离 <span style="color: red;">${text}</span> 剩余 ${countdown} 天'; // 移动端右侧栏倒计时模板 // TODO: i18n
        this.data[STORAGE_NAME].mobileRightCountdown.text ??= "2100年"; // 移动端右侧栏倒计时文本
        this.data[STORAGE_NAME].mobileRightCountdown.targetTime ??= "2100-01-01"; // 移动端右侧栏倒计时时间

        // 插件设置
        this.setting = new Setting({
            confirmCallback: () => {
                // applySetting();
            }
        });

        // ${text} 将会替换为文本，${countdown} 将会替换为剩余时间

        // // changeButtonText：开关按钮
        // // <input class="b3-switch fn__flex-center" id="changeButtonText" type="checkbox" checked="">
        // const changeButtonTextElement = document.createElement("input");
        // changeButtonTextElement.type = "checkbox";
        // changeButtonTextElement.id = "changeButtonText";
        // changeButtonTextElement.className = "b3-switch fn__flex-center";
        // changeButtonTextElement.checked = this.data[STORAGE_NAME].changeButtonText;
        // this.setting.addItem({
        //     title: this.i18n.changeButtonText,
        //     direction: "column",
        //     createActionElement: () => changeButtonTextElement,
        // });

        // // 应用配置
        // const applySetting = async () => {
        //     // 需要 await 等待配置更新完成之后再使用 this.data[STORAGE_NAME]，否则会使用旧的配置
        //     await this.saveData(STORAGE_NAME, {
        //         changeButtonText: changeButtonTextElement.checked
        //     });
        //     // 修改配置后，如果内容有变化，需要重新插入元素
        //     this.insertElement("topbarRight");
        //     this.insertElement("topbarLeft");
        //     this.insertElement("mobileRight");
        // };
    }

    onLayoutReady() {
        if (!this.isMobile) {
            this.topbarDragElement = document.querySelector(".toolbar > #drag") as HTMLElement;
        } else {
            this.accountMenuElement = document.querySelector("#menuAccount.b3-menu__item") as HTMLElement;
        }
        if (!this.topbarDragElement && !this.accountMenuElement) {
            console.error(this.displayName, this.i18n.onloadFailed);
            return;
        }

        // 插入元素
        this.insertElement("topbarRight", true);
        this.insertElement("topbarLeft", true);
        this.insertElement("mobileRight", true);

        console.log(this.displayName, this.i18n.onload);
    }

    onunload() {
        // 移除元素
        const countdownElements = document.querySelectorAll(":is(#top-bar-text-topbarRight, #top-bar-text-topbarLeft, #top-bar-text-mobileRight)");
        countdownElements.forEach(element => {
            element.remove();
        });

        console.log(this.displayName, this.i18n.onunload);
    }

    async uninstall() {
        // 移除元素
        const countdownElements = document.querySelectorAll(":is(#top-bar-text-topbarRight, #top-bar-text-topbarLeft, #top-bar-text-mobileRight)");
        countdownElements.forEach(element => {
            element.remove();
        });

        // 删除配置
        await this.removeData(STORAGE_NAME);

        console.log(this.displayName, this.i18n.uninstall);
    }

    private calculateDaysLeft: (targetDate: Date) => number | null = (targetDate: Date) => {
        const targetDateTimestamp = targetDate.getTime();
        if (isNaN(targetDateTimestamp)) return null;

        const currentDate = new Date();
        const differenceInTime = targetDateTimestamp - currentDate.getTime();
        // TODO: 这里需要支持模板，比如 `${year} 年 ${month} 月 ${day} 日 ${hour} 时 ${minute} 分 ${second} 秒`，根据不同的级别来决定元素的更新时间间隔，比如每秒更新一次元素
        const daysLeft = Math.max(Math.ceil(differenceInTime / (1000 * 3600 * 24)) - 1, 0);
        return daysLeft;
    }

    private insertElement = (type: "topbarLeft" | "topbarRight" | "mobileRight", isFirstInsert: boolean = false) => {
        const countdownElement = document.getElementById(`top-bar-text-${type}`);
        let countdownHTML = "";
        const countdownTemplate = this.data[STORAGE_NAME][`${type}Countdown`].template;
        if (countdownTemplate) {
            countdownHTML = countdownTemplate
                .replace("${text}", this.data[STORAGE_NAME][`${type}Countdown`].text ?? "${text}")
                .replace("${countdown}", this.calculateDaysLeft(new Date(this.data[STORAGE_NAME][`${type}Countdown`].targetTime)) || "${countdown}");
        }

        if (this.isMobile) {
            if (type === "mobileRight") {
                // TODO: 移动端右侧栏的账号选项上方
                if (!countdownHTML) return;
    
                if (countdownElement) {
                    countdownElement.innerHTML = countdownHTML;
                } else {
                    const element = document.createElement("div");
                    element.id = `top-bar-text-mobileRight`;
                    element.className = "b3-menu__item";
                    element.innerHTML = countdownHTML;
                    this.accountMenuElement.insertAdjacentElement("beforebegin", element);
                }
            }
        } else {
            if (type === "topbarRight") {
                // 桌面端顶栏右侧
                if (!countdownHTML) return;
    
                if (countdownElement) {
                    countdownElement.innerHTML = countdownHTML;
                } else {
                    const element = document.createElement("div");
                    element.id = `top-bar-text-${type}`;
                    element.style.fontSize = getComputedStyle(this.topbarDragElement).fontSize;
                    if (isFirstInsert) {
                        setTimeout(() => {
                            element.style.fontSize = getComputedStyle(this.topbarDragElement).fontSize; // 可能有的主题会修改 topbarDragElement 元素的字号，所以这里重新获取一次
                        }, 700);
                    }
                    element.style.color = "var(--b3-toolbar-color)";
                    element.style.padding = "0 4px";
                    // @ts-ignore webkitAppRegion 不是标准属性，忽略 TS 检查
                    element.style.webkitAppRegion = "drag";
                    element.innerHTML = countdownHTML;
                    this.topbarDragElement.insertAdjacentElement("afterend", element);
                }
            } else if (type === "topbarLeft") {
                if (!countdownHTML) return;
    
                if (countdownElement) {
                    countdownElement.innerHTML = countdownHTML;
                } else {
                    const element = document.createElement("div");
                    element.id = `top-bar-text-${type}`;
                    element.style.fontSize = getComputedStyle(this.topbarDragElement).fontSize;
                    if (isFirstInsert) {
                        setTimeout(() => {
                            element.style.fontSize = getComputedStyle(this.topbarDragElement).fontSize; // 可能有的主题会修改 topbarDragElement 元素的字号，所以这里重新获取一次
                        }, 700);
                    }
                    element.style.color = "var(--b3-toolbar-color)";
                    element.style.padding = "0 4px";
                    // @ts-ignore
                    element.style.webkitAppRegion = "drag";
                    element.innerHTML = countdownHTML;
                    this.topbarDragElement.insertAdjacentElement("beforebegin", element);
                }
            }
        }
    }
}

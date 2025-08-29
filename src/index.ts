import {
    Plugin,
    Setting,
    getFrontend,
} from "siyuan";
import "./index.scss";

const STORAGE_NAME = "top-bar-text-config.json";
const ELEMENT_TYPE = ["topbarRight", "topbarLeft", "mobileRight"];

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
        // 初始化配置
        this.data[STORAGE_NAME] ||= {}; // 默认是空字符串，所以用 ||? 而不是 ??=
        ELEMENT_TYPE.forEach(type => {
            this.data[STORAGE_NAME][`${type}Countdown`] ??= {};
        });
        // 默认配置
        this.data[STORAGE_NAME].topbarRightCountdown.template   ??= this.i18n.topbarRightCountdownTemplateDefault;   // 顶栏右侧倒计时模板
        this.data[STORAGE_NAME].topbarRightCountdown.text       ??= this.i18n.topbarRightCountdownTextDefault;       // 顶栏右侧倒计时文本
        this.data[STORAGE_NAME].topbarRightCountdown.targetTime ??= this.i18n.topbarRightCountdownTargetTimeDefault; // 顶栏右侧倒计时时间
        // 调试用：
        // this.data[STORAGE_NAME].topbarLeftCountdown.template ??= '示例：距离 <span style="color: red;">${text}</span> 剩余 ${year} 年 ${day} 天'; // 顶栏左侧倒计时模板
        // this.data[STORAGE_NAME].topbarLeftCountdown.text ??= "2100年"; // 顶栏左侧倒计时文本
        // this.data[STORAGE_NAME].topbarLeftCountdown.targetTime ??= "2100-01-01"; // 顶栏左侧倒计时时间
        // this.data[STORAGE_NAME].mobileRightCountdown.template ??= '示例：距离 <span style="color: red;">${text}</span> 剩余 ${year} 年 ${day} 天'; // 移动端右侧栏倒计时模板
        // this.data[STORAGE_NAME].mobileRightCountdown.text ??= "2100年"; // 移动端右侧栏倒计时文本
        // this.data[STORAGE_NAME].mobileRightCountdown.targetTime ??= "2100-01-01"; // 移动端右侧栏倒计时时间

        // 插件设置
        this.setting = new Setting({
            confirmCallback: () => {
                applySetting();
            }
        });

        // 设置项创建方法
        const createCountdownSettingItem = (type: string, field: string, titleKey: string, placeholderKey: string) => {
            // 都用 <textarea class="b3-text-field fn__block" id="" spellcheck="false"></textarea>
            const element = document.createElement("textarea");
            element.id = `${type}${field}`;
            element.className = "b3-text-field fn__block";
            element.placeholder = this.i18n[placeholderKey];
            element.style.resize = "vertical";
            element.value = this.data[STORAGE_NAME][`${type}Countdown`][field] ?? "";
            
            this.setting.addItem({
                title: this.i18n[titleKey],
                direction: "row",
                createActionElement: () => element,
            });
            
            return element;
        };

        // 批量创建所有类型的配置项
        const createAllCountdownSettings = (type: string) => {
            const fields = [
                { field: "template", titleKey: `${type}CountdownTemplate`, placeholderKey: "placeholderCountdownTemplate" },
                { field: "text", titleKey: `${type}CountdownText`, placeholderKey: "placeholderCountdownText" },
                { field: "targetTime", titleKey: `${type}CountdownTargetTime`, placeholderKey: "placeholderCountdownTargetTime" }
            ];
            
            return fields.map(({ field, titleKey, placeholderKey }) => 
                createCountdownSettingItem(type, field, titleKey, placeholderKey)
            );
        };

        // 创建所有配置项
        const [topbarRightCountdownTemplateElement, topbarRightCountdownTextElement, topbarRightCountdownTargetTimeElement] = 
            createAllCountdownSettings("topbarRight");
        const [topbarLeftCountdownTemplateElement, topbarLeftCountdownTextElement, topbarLeftCountdownTargetTimeElement] = 
            createAllCountdownSettings("topbarLeft");
        const [mobileRightCountdownTemplateElement, mobileRightCountdownTextElement, mobileRightCountdownTargetTimeElement] = 
            createAllCountdownSettings("mobileRight");

        // 应用配置
        const applySetting = async () => {
            const topbarRightCountdown = {
                template: topbarRightCountdownTemplateElement.value,
                text: topbarRightCountdownTextElement.value,
                targetTime: topbarRightCountdownTargetTimeElement.value,
            };
            const topbarLeftCountdown = {
                template: topbarLeftCountdownTemplateElement.value,
                text: topbarLeftCountdownTextElement.value,
                targetTime: topbarLeftCountdownTargetTimeElement.value,
            };
            const mobileRightCountdown = {
                template: mobileRightCountdownTemplateElement.value,
                text: mobileRightCountdownTextElement.value,
                targetTime: mobileRightCountdownTargetTimeElement.value,
            };
            // 需要 await 等待配置更新完成之后再使用 this.data[STORAGE_NAME]，否则会使用旧的配置
            await this.saveData(STORAGE_NAME, {
                topbarRightCountdown,
                topbarLeftCountdown,
                mobileRightCountdown,
            });
            // 修改配置后重新插入元素
            ELEMENT_TYPE.forEach(type => {
                this.insertElement(type);
            });
        };
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
        ELEMENT_TYPE.forEach(type => {
            this.insertElement(type, true);
        });

        console.log(this.displayName, this.i18n.onload);
    }

    onunload() {
        // 移除元素
        ELEMENT_TYPE.forEach(type => {
            const countdownElement = document.getElementById(`top-bar-text-${type}`);
            if (countdownElement) {
                countdownElement.remove();
            }
        });

        console.log(this.displayName, this.i18n.onunload);
    }

    async uninstall() {
        // 移除元素
        ELEMENT_TYPE.forEach(type => {
            const countdownElement = document.getElementById(`top-bar-text-${type}`);
            if (countdownElement) {
                countdownElement.remove();
            }
        });

        // 删除配置
        await this.removeData(STORAGE_NAME);

        console.log(this.displayName, this.i18n.uninstall);
    }

    private calculateDaysLeft = (template: string, type: string) => {
        const targetDateTimestamp = new Date(this.data[STORAGE_NAME][`${type}Countdown`].targetTime).getTime();
        if (isNaN(targetDateTimestamp)) return template; // targetTime 可能不存在，也可能格式不正确

        let timeDifference = targetDateTimestamp - new Date().getTime();
        // 判断模板中是否包含对应占位符
        const hasYear   = template.includes("${year}");
        const hasMonth  = template.includes("${month}");
        const hasDay    = template.includes("${day}");
        const hasHour   = template.includes("${hour}");
        const hasMinute = template.includes("${minute}");
        const hasSecond = template.includes("${second}");
        // TODO: 这里需要根据最低的级别来决定元素的更新时间间隔，比如每秒更新一次元素

        // 替换模板中的占位符
        let countdownHTML = template;
        const currentDate = new Date();
        
        if (hasYear) {
            // 考虑不同年份的天数
            // 判断目标月日是否早于当前月日
            const targetDate = new Date(targetDateTimestamp);
            let yearDiff = targetDate.getFullYear() - currentDate.getFullYear();

            // 如果目标日期的月日早于当前日期，则年数需减一
            if (
                yearDiff > 0 &&
                (
                    targetDate.getMonth() < currentDate.getMonth() ||
                    (targetDate.getMonth() === currentDate.getMonth() && targetDate.getDate() < currentDate.getDate())
                )
            ) {
                yearDiff--;
            }

            // 年差为负数时归零
            if (yearDiff < 0) {
                yearDiff = 0;
            }

            // 更新 timeDifference：减去已计算的年数对应的毫秒数
            if (yearDiff > 0) {
                // 生成当前日期加 yearDiff 年后的日期
                const tempDate = new Date(currentDate);
                tempDate.setFullYear(tempDate.getFullYear() + yearDiff);
                timeDifference = targetDateTimestamp - tempDate.getTime();
            }

            countdownHTML = countdownHTML.replaceAll("${year}", yearDiff.toString());
        }
        if (hasMonth) {
            // 考虑不同月份的天数
            let monthDiff = 0;
            const targetDateTimestamp2 = new Date(currentDate.getTime() + timeDifference).getTime();
            
            if (timeDifference > 0) {
                // 从当前时间开始，逐月递增计算月数
                let tempDate = new Date(currentDate);
                
                // 逐月递增，直到超过目标日期
                while (tempDate.getTime() < targetDateTimestamp2) {
                    tempDate.setMonth(tempDate.getMonth() + 1);
                    monthDiff++;
                }
                
                // 如果超过了目标日期，回退一个月
                if (tempDate.getTime() > targetDateTimestamp2) {
                    monthDiff--;
                }
            }
            
            // 更新 timeDifference：减去已计算的月数对应的毫秒数
            if (monthDiff > 0) {
                const tempDate = new Date();
                tempDate.setMonth(tempDate.getMonth() + monthDiff);
                timeDifference = new Date(currentDate.getTime() + timeDifference).getTime() - tempDate.getTime();
            }
            
            countdownHTML = countdownHTML.replaceAll("${month}", monthDiff.toString());
        }
        if (hasDay) {
            const day = Math.floor(timeDifference / (1000 * 3600 * 24));
            timeDifference = timeDifference % (1000 * 3600 * 24);
            countdownHTML = countdownHTML.replaceAll("${day}", day.toString());
        }
        if (hasHour) {
            const hour = Math.floor(timeDifference / (1000 * 3600));
            timeDifference = timeDifference % (1000 * 3600);
            countdownHTML = countdownHTML.replaceAll("${hour}", hour.toString());
        }
        if (hasMinute) {
            const minute = Math.floor(timeDifference / (1000 * 60));
            timeDifference = timeDifference % (1000 * 60);
            countdownHTML = countdownHTML.replaceAll("${minute}", minute.toString());
        }
        if (hasSecond) {
            const second = Math.floor(timeDifference / 1000);
            countdownHTML = countdownHTML.replaceAll("${second}", second.toString());
        }
        return countdownHTML;
    }

    private insertElement = (type: (typeof ELEMENT_TYPE)[number], isFirstInsert: boolean = false) => {
        const countdownElement = document.getElementById(`top-bar-text-${type}`);
        let countdownHTML = "";
        const genCountdownHTML = () => {
            const countdownTemplate = this.data[STORAGE_NAME][`${type}Countdown`].template;
            if (countdownTemplate) {
                countdownHTML = this.calculateDaysLeft(countdownTemplate, type);
                countdownHTML = countdownHTML.replaceAll("${text}", this.data[STORAGE_NAME][`${type}Countdown`].text ?? "${text}");
            }
        }

        if (this.isMobile) {
            if (type === "mobileRight") {
                // 移动端右侧栏的账号选项上方
                genCountdownHTML();
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
        } else if (type === "topbarRight" || type === "topbarLeft") {
            // 桌面端顶栏右侧或左侧
            genCountdownHTML();
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
                if (type === "topbarRight") {
                    this.topbarDragElement.insertAdjacentElement("afterend", element);
                } else {
                    this.topbarDragElement.insertAdjacentElement("beforebegin", element);
                }
            }
        }
    }

    private updateCountdownElement = (type: (typeof ELEMENT_TYPE)[number]) => {
        this.insertElement(type);
    }
}

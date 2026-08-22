import {
    Plugin,
    Setting,
    getFrontend,
} from "siyuan";
import "./index.scss";

const STORAGE_NAME = "top-bar-text-config.json";
const ELEMENT_TYPE = ["topbarRight", "topbarLeft", "mobileRight"];
const DRAG_HIDDEN_ATTR = "data-top-bar-text-drag-hidden";

// 原始代码片段：https://ld246.com/article/1728048965009
export default class TopBarTextPlugin extends Plugin {
    private isMobile = false;
    private topbarDragElement: HTMLElement | undefined;
    private toolbarElement: HTMLElement | undefined;
    private mobileMenuAnchorElement: HTMLElement | undefined;
    private dragHiddenObserver: MutationObserver | undefined;
    private lastDragHidden: boolean | undefined;
    private updateTimers: Map<string, number> = new Map(); // 存储各元素的更新定时器
    private hourlyUpdateTimer: number = 0; // 整点更新定时器
    
    async onload() {
        const frontEnd = getFrontend();
        this.isMobile = frontEnd === "mobile" || frontEnd === "browser-mobile";
        // 加载配置
        await this.loadData(STORAGE_NAME);
        // loadData 在配置文件不存在时返回空字符串，需归一化为对象
        if (typeof this.data[STORAGE_NAME] !== "object" || this.data[STORAGE_NAME] === null) {
            this.data[STORAGE_NAME] = {};
        }
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
            
            // 检查每个倒计时模板
            ELEMENT_TYPE.forEach(type => {
                const template = this.data[STORAGE_NAME][`${type}Countdown`]?.template;
                if (!template || template.trim() === "") {
                    // 模板为空字符串，移除倒计时元素
                    const countdownElement = document.getElementById(`top-bar-text-${type}`);
                    if (countdownElement) {
                        countdownElement.remove();
                    }
                    // 停止该元素的定时器
                    this.stopUpdateTimer(type);
                } else {
                    // 模板不为空，重新插入元素
                    this.insertElement(type);
                }
            });
            
            // 重新启动所有定时器（因为配置可能改变了更新间隔）
            ELEMENT_TYPE.forEach(type => {
                this.startUpdateTimer(type);
            });
            
            // 重新启动整点更新定时器
            this.startHourlyUpdateTimer();
        };
    }

    onLayoutReady() {
        if (!this.isMobile) {
            // 使用 #toolbar 限定顶栏，避免匹配到其他 .toolbar 容器
            this.topbarDragElement = document.querySelector("#toolbar > #drag") as HTMLElement;
            if (!this.topbarDragElement) {
                // 独立窗口没有顶栏
                return;
            }
        } else {
            // 移动端右侧栏第一个分组前方
            this.mobileMenuAnchorElement = document.querySelector("#menu .b3-menu__items > .b3-menu__group") as HTMLElement;
            if (!this.mobileMenuAnchorElement) {
                console.error(this.displayName, this.i18n.onloadFailed);
                return;
            }
        }

        if (!this.isMobile) {
            this.startDragHiddenObserver();
        }

        // 插入元素
        ELEMENT_TYPE.forEach(type => {
            this.insertElement(type, true);
        });

        // 启动所有定时器
        ELEMENT_TYPE.forEach(type => {
            this.startUpdateTimer(type);
        });

        // 启动整点更新定时器
        this.startHourlyUpdateTimer();

        console.log(this.displayName, this.i18n.onload);
    }

    onunload() {
        this.stopDragHiddenObserver();

        // 移除元素
        ELEMENT_TYPE.forEach(type => {
            const countdownElement = document.getElementById(`top-bar-text-${type}`);
            if (countdownElement) {
                countdownElement.remove();
            }
        });

        // 停止所有定时器
        this.stopAllUpdateTimers();

        // 停止整点更新定时器
        this.stopHourlyUpdateTimer();

        console.log(this.displayName, this.i18n.onunload);
    }

    async uninstall() {
        this.stopDragHiddenObserver();

        // 移除元素
        ELEMENT_TYPE.forEach(type => {
            const countdownElement = document.getElementById(`top-bar-text-${type}`);
            if (countdownElement) {
                countdownElement.remove();
            }
        });

        // 停止所有定时器
        this.stopAllUpdateTimers();

        // 停止整点更新定时器
        this.stopHourlyUpdateTimer();

        // 删除配置
        await this.removeData(STORAGE_NAME);

        console.log(this.displayName, this.i18n.uninstall);
    }

    /** 跟随 #drag.fn__hidden，把状态记在 #toolbar 上，避免拖拽区挡住全屏后的按钮 */
    private syncTopbarDragHidden = () => {
        const hidden = !!this.topbarDragElement?.classList.contains("fn__hidden");
        if (hidden === this.lastDragHidden) {
            return;
        }
        this.lastDragHidden = hidden;
        this.toolbarElement?.toggleAttribute(DRAG_HIDDEN_ATTR, hidden);
    };

    private startDragHiddenObserver = () => {
        this.stopDragHiddenObserver();
        if (!this.topbarDragElement) {
            return;
        }
        this.toolbarElement = this.topbarDragElement.parentElement ?? undefined;
        this.dragHiddenObserver = new MutationObserver(() => {
            this.syncTopbarDragHidden();
        });
        this.dragHiddenObserver.observe(this.topbarDragElement, {
            attributes: true,
            attributeFilter: ["class"],
        });
        this.syncTopbarDragHidden();
    };

    private stopDragHiddenObserver = () => {
        this.dragHiddenObserver?.disconnect();
        this.dragHiddenObserver = undefined;
        this.lastDragHidden = undefined;
        this.toolbarElement?.removeAttribute(DRAG_HIDDEN_ATTR);
    };

    /**
     * 根据模板中的时间占位符计算更新间隔
     * @param template 倒计时模板
     * @returns 更新间隔（毫秒）
     */
    private getUpdateInterval = (template: string): number => {
        // 按优先级检查时间占位符，返回最低级别的更新间隔
        if (template.includes("${second}")) {
            return 1000; // 1 秒
        } else if (template.includes("${minute}")) {
            return 60 * 1000; // 1 分钟
        } else if (template.includes("${hour}") || template.includes("${day}") || template.includes("${month}") || template.includes("${year}")) {
            return 60 * 60 * 1000; // 1 小时
        }
        return 0; // 无时间占位符，不需要定时更新
    }

    /**
     * 启动指定元素的定时更新
     * @param type 元素类型
     */
    private startUpdateTimer = (type: (typeof ELEMENT_TYPE)[number]) => {
        // 先停止现有的定时器
        this.stopUpdateTimer(type);
        
        const template = this.data[STORAGE_NAME][`${type}Countdown`]?.template;
        if (!template) return;
        
        const interval = this.getUpdateInterval(template);
        if (interval <= 0) return; // 不需要定时更新
        
        // 启动新的定时器
        const timerId = window.setInterval(() => {
            this.updateCountdownElement(type);
        }, interval);
        
        this.updateTimers.set(type, timerId);
    }

    /**
     * 停止指定元素的定时更新
     * @param type 元素类型
     */
    private stopUpdateTimer = (type: (typeof ELEMENT_TYPE)[number]) => {
        const timerId = this.updateTimers.get(type);
        if (timerId) {
            window.clearInterval(timerId);
            this.updateTimers.delete(type);
        }
    }

    /**
     * 停止所有定时器
     */
    private stopAllUpdateTimers = () => {
        this.updateTimers.forEach((timerId, type) => {
            window.clearInterval(timerId);
        });
        this.updateTimers.clear();
    }

    /**
     * 启动整点更新定时器
     */
    private startHourlyUpdateTimer = () => {
        // 先停止现有的整点更新定时器
        this.stopHourlyUpdateTimer();
        
        // 计算距离下一个整点后30秒的毫秒数
        const now = new Date();
        const nextHour = new Date(now);
        nextHour.setHours(now.getHours() + 1, 0, 30, 0); // 整点后30秒
        const delayToNextUpdate = nextHour.getTime() - now.getTime();
        
        // 设置定时器，在下一个整点后30秒触发
        this.hourlyUpdateTimer = window.setInterval(() => {
            // 在整点后30秒更新所有元素
            ELEMENT_TYPE.forEach(type => {
                this.updateCountdownElement(type);
            });
            
            // 停止当前定时器，重新计算下一个整点后30秒
            this.stopHourlyUpdateTimer();
            this.startHourlyUpdateTimer();
        }, delayToNextUpdate);
    }

    /**
     * 停止整点更新定时器
     */
    private stopHourlyUpdateTimer = () => {
        if (this.hourlyUpdateTimer) {
            window.clearInterval(this.hourlyUpdateTimer);
            this.hourlyUpdateTimer = 0;
        }
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
                // 移动端右侧栏第一个 b3-menu__group 前面
                if (!this.mobileMenuAnchorElement) return;
                genCountdownHTML();
                if (!countdownHTML) return;
    
                if (countdownElement) {
                    const labelElement = countdownElement.querySelector(".b3-menu__label");
                    if (labelElement) {
                        labelElement.innerHTML = countdownHTML;
                    }
                } else {
                    const element = document.createElement("div");
                    element.id = "top-bar-text-mobileRight";
                    element.className = "b3-menu__group";
                    element.innerHTML = `<div class="b3-menu__group-items">
    <div class="b3-menu__item b3-menu__item--readonly">
        <span class="b3-menu__label">${countdownHTML}</span>
    </div>
</div>`;
                    this.mobileMenuAnchorElement.insertAdjacentElement("beforebegin", element);
                }
            }
        } else if (type === "topbarRight" || type === "topbarLeft") {
            // 桌面端顶栏右侧或左侧
            const topbarDragElement = this.topbarDragElement;
            if (!topbarDragElement) return;
            genCountdownHTML();
            if (!countdownHTML) return;

            if (countdownElement) {
                countdownElement.innerHTML = countdownHTML;
                countdownElement.setAttribute("aria-label", countdownElement.textContent || "");
            } else {
                const element = document.createElement("div");
                element.id = `top-bar-text-${type}`;
                element.style.fontSize = getComputedStyle(topbarDragElement).fontSize;
                if (isFirstInsert) {
                    setTimeout(() => {
                        element.style.fontSize = getComputedStyle(topbarDragElement).fontSize; // 可能有的主题会修改 topbarDragElement 元素的字号，所以这里重新获取一次
                    }, 700);
                }
                element.innerHTML = countdownHTML;
                element.setAttribute("aria-label", element.textContent || "");
                if (type === "topbarRight") {
                    topbarDragElement.insertAdjacentElement("afterend", element);
                } else {
                    topbarDragElement.insertAdjacentElement("beforebegin", element);
                }
            }
        }
    }

    private updateCountdownElement = (type: (typeof ELEMENT_TYPE)[number]) => {
        this.insertElement(type);
    }
}

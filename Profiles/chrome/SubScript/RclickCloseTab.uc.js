// ==UserScript==
// @name         RclickCloseTab.uc.js
// @version      1.1
// @author       hua.andy@gmail.com
// @include      main
// @async        true
// @sandbox      true
// @homepageURL  https://github.com/adonais/iceweasel-userchrome
// ==/UserScript==

(async function() {
    'use strict';

    // 获取全局的标签页浏览器对象（注意是 gBrowser，不是 gbrowser）
    const { gBrowser } = window;

    // 监听标签页容器的右键菜单事件（contextmenu 更符合右键逻辑）
    gBrowser.tabContainer.addEventListener("contextmenu", function(event) {
        // 检查是否为纯右键点击（无 Shift 或 Ctrl 键）
        if (!event.shiftKey && !event.ctrlKey && !event.altKey) {
            // 查找被点击的标签页元素
            const tab = event.target.closest('.tabbrowser-tab');
            if (!tab) return;

            // 阻止事件冒泡和默认的标签页菜单
            event.stopPropagation();
            event.preventDefault();

            // 关闭标签页（带动画效果） - 注意：只需调用一次
            gBrowser.removeTab(tab, { animate: true });
        }
    }, false);
})();

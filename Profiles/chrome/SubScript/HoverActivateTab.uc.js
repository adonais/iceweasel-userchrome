// ==UserScript==
// @name            HoverActivateTab.uc.js
// @version         1.2
// @author          hua.andy@gmail.com
// @include         main
// @async           true
// @sandbox         true
// @homepageURL     https://github.com/adonais/iceweasel-userchrome
// ==/UserScript==

(async function() {
    'use strict';

    // 配置悬停延迟时间（单位：毫秒，可根据需要调整）
    const HOVER_DELAY = 150;

    let hoverTimeout = null;
    let hoveredTab = null;

    function activateHoveredTab() {
        if (hoveredTab && !hoveredTab.selected) {
            gBrowser.selectedTab = hoveredTab;
        }
        hoveredTab = null;
        hoverTimeout = null;
    }

    function clearHoverState() {
        if (hoverTimeout) {
            clearTimeout(hoverTimeout);
            hoverTimeout = null;
        }
        hoveredTab = null;
    }

    // 监听标签页容器的鼠标悬停事件
    gBrowser.tabContainer.addEventListener('mouseover', function(event) {
        let tab = event.target;
        // 确保鼠标悬停在标签页元素上，而不是标签页内的文字或图标
        while (tab && tab.localName !== 'tab') {
            tab = tab.parentNode;
        }
        if (!tab || tab.selected || !gBrowser.tabs.includes(tab)) {
            return;
        }
        if (event.ctrlKey || event.shiftKey || event.altKey) {
            return;
        }
        clearHoverState();
        hoveredTab = tab;
        hoverTimeout = setTimeout(activateHoveredTab, HOVER_DELAY);
    }, true);

    // 监听鼠标离开标签页容器的事件
    gBrowser.tabContainer.addEventListener('mouseout', function(event) {
        let relatedTarget = event.relatedTarget;
        // 如果鼠标移出到标签页容器之外，或者移到了另一个标签页上，则清除激活计划
        if (!relatedTarget || !gBrowser.tabContainer.contains(relatedTarget)) {
            clearHoverState();
        }
    }, true);

    // 当标签页被移除或浏览器窗口关闭时清理资源
    window.addEventListener('unload', function() {
        clearHoverState();
    }, false);

})();

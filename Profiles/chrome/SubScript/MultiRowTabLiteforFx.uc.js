// ==UserScript==
// @name           MultiRowTabLiteforFx.uc.js
// @namespace      https://github.com/Izheil/Quantum-Nox-Firefox-Customizations
// @include        main
// @compatibility  Firefox 157 to Firefox 160.0a1， Compatible with ESR115 (2026-10-23)
// @author         Alice0775, Endor8, TroudhuK, Izheil, Merci-chao， adonais, AI
// @homepageURL    https://github.com/adonais/iceweasel-userchrome
// @async          true
// @sandbox        true
// @version        23/10/2026 04:10 Stop hiding the window controls (minimize/maximize/close) automatically in the vertical tab bar layout. The nav bar copy of the button box, which is the one Firefox shows there, is no longer hidden, and hideWindowControlsMenu now controls the window controls in both the horizontal and the vertical layout.
// @version        22/10/2026 23:00 Add optional showCloseButtonOnlyOnActiveTab feature: when enabled, the tab close (X) button is only visible on the active/selected tab. Works on ESR115+ without using :has() selectors.
// @version        22/10/2026 22:10 Fix drag drop indicator staying visible after dropping tabs on ESR115: manually hide the indicator and reset drag state after drop/dragend/dragleave, since our event interception blocks the native cleanup code.
// @version        22/10/2026 21:30 Fix multi-row tab dragging on Firefox ESR115: bind drag event listeners in capture phase with stopImmediatePropagation to override the native listeners that were already bound via addEventListener at init time (assigning to .on_dragover/_onDragOver properties had no effect there). Also use event.composedPath() for empty space detection to see through the shadow DOM of arrowScrollbox, so tabs dropped on empty area correctly go to the end.
// @version        22/10/2026 21:00 Fix missing call to setupTabBarOrientationMarker, which kept the window controls visible on Firefox ESR115. Also fix the pinned tabs height rule on ESR115 the same way.
// @version        21/10/2026 21:30 Keep the orientation of the tab bar on the root element instead of using :has(), so the window controls get hidden on Firefox ESR115 too.
// @version        21/10/2026 07:22 Hide the titlebar spacers together with the window controls in the horizontal tab bar.
// @version        21/10/2026 07:09 Hide the window controls (minimize/maximize/close) in the horizontal tab bar as well, matching the vertical tab bar.
// @version        21/10/2026 06:35 Initialise based on document.readyState instead of platform, so cold starts on Linux/macOS work reliably.
// @version        21/10/2026 06:20 Keep the native tab dragging behaviour instead of pinning the dragged tab.
// @version        21/10/2026 05:47 Add a vertical tab bar exception to the pinned tabs height fix.
// @version        21/10/2026 05:30 Restore pinned tabs to their original state when switching to the vertical tab bar.
// @version        01/09/2026 18:48 Fix issues with tab dragging.
// @version        21/08/2026 16:15 Fix issue with group before pinned tabs on session restore.
// @version        14/05/2026 18:13 Fix ownerGlobal property being deprecated in FF152+
// @version        29/03/2026 03:58 Fix issue with new button and split view
// @version        15/03/2026 22:05 Add toggle for resizing or not tabs when they have icons
// @version        17/02/2026 23:38 Fix issue with dragging tabs to the end
// @version        12/02/2026 18:40 Fix dragging tabs from a tab group
// @version        30/11/2025 05:24 Fix the all tabs button displacing the new tab button on new row
// @version        03/10/2025 02:59 Fix tab group label showing on move
// @version        01/10/2025 06:15 Fix issues with tab group moving
// @version        27/09/2025 06:40 Fix issues with tab groups
// @version        12/07/2025 00:28 Fix spacing with tab groups and new tab button
// ==/UserScript==

(async () => {
    'use strict';

    const TAB_SELECTOR = "tab";
    const TAB_GROUP_SELECTOR = "tab-group";

    // Root element attribute that tells the stylesheet if the horizontal multirow tab bar is
    // being used. It stands in for the :has() based rules, see setupTabBarOrientationMarker().
    const TAB_BAR_HORIZONTAL_ATTR = "multirowtabs-horizontal";

    const version_ge = (v) => {return Services.vc.compare(Services.appinfo.version, v) >= 0;}

    // Don't change these
    let lastKnownIndex = null;
    let groupToInsertTo = null;
    let positionInGroup = null;
    let draggedTabIndex = null;

    // Keep the native tab dragging behaviour: dragging a tab around only reorders it and never
    // turns it into a pinned tab. A pinned tab dropped between the pinned tabs keeps its pinned
    // state, and dragging a pinned tab out of the pinned tabs area still unpins it, which is
    // what Firefox does natively as well.
    // Set this to false to restore the old behaviour, where dropping a tab inside the pinned
    // tabs area pinned it.
    // This option lives here instead of with the ones inside the main function, because the tab
    // dragging helpers that read it are declared outside of that function.
    const keepNativeTabDragBehavior = true;

    async function zzzz_MultiRowTabLite() {
        // Allow tabs resizing when there is an icon (like the sound icon)
        // Only change this if you don't want the tabs to resize when having an icon.
        const allowResizeWithIcon = true;

        // If the all tabs drop-down box should be hidden
        const hideAllTabs = true;

        // Make tabs grow horizontally to fill all available space
        const fullWidthTabs = false;

        // If the new tab button should be hidden
        const hideNewTabBtn = false;

        // If the minimize/maximize/close buttons should be hidden. This applies to both tab bar
        // layouts: the horizontal multirow tab bar and the vertical tab bar.
        // While this is false (the default) the window controls are left exactly where Firefox
        // puts them, so they stay visible in the vertical tab bar layout instead of being hidden
        // automatically. When the horizontal tab bar is used, the titlebar spacers Firefox
        // reserves for those buttons (40px empty drag areas) are hidden together with them.
        const hideWindowControlsMenu = false;

        // Only show the tab close (X) button on the currently active/selected tab.
        // When enabled, non-active tabs will not display their close button, reducing visual
        // clutter and saving tab width space.
        // If you want the close button to also appear when hovering over inactive tabs,
        // change the rule below from "display: none" to "visibility: collapse" and add a
        // `.tabbrowser-tab:not([selected]):hover .tab-close-button { visibility: visible !important; }` rule.
        // Compatible with Firefox ESR115 and above (uses [selected] attribute selector, not :has()).
        const showCloseButtonOnlyOnActiveTab = false;

        // Minimum width of tab
        const tabMinWidth = 154;

        // If pinned tabs should be handed back to the vertical tab bar when it is enabled.
        // Firefox keeps them collapsed (favicon only) only while they live in the pinned
        // tabs container, so this restores them to that original state.
        const restorePinnedTabsOnVerticalMode = true;

        let css =`
        /* MULTIROW TABS CSS */

        /* EDITABLE CSS VARIABLES */

        /* You can change the tab width here.

         - For tab minimum width, you have to go to about:config and modify [browser.tabs.tabMinWidth]
           to the value you want. You shouldn't use values lower than 58 for this setting or tabs will
           start to overlap, and scrolling with the wheel will stop working.

         - For tab width growth v
            Value of 1 -> Tab grows. Fixed max width of 226px.
            Value of 0 -> Tab doesn't grow. Uses tab min width as fixed width.
        */

        :root {
            --tab-growth: 1;
        }

        /* You can change the height of tabs here.

           If you want a more compact view, you can toggle compact mode by setting [browser.compactmode.show] as
           "true" on about:config, and then turn on compact density on the customize page (right click empty space
           on tab bar -> Customize/personalize toolbar (should be the last option) -> Density select box).

           Using compact view will make your tabs smaller in height in a more supported way than the variables
           here can.

           If you want a custom tab height smaller than the default but different than compact view, change the
           "inherit" value in #TabsToolbar --tab-min-height variable to the value you want.

           For reference, in Proton, the default heights by density are as follows:
           - Compact mode: 28px (with 8px padding)
           - Regular mode: 32px (with 12px padding)
           - Touch mode: 36px (with 12px padding)

           Note that with Nova, when there is media playing, the tab text will appear in 2 lines, and unlike
           with compact mode this won't be changed to fit with a custom height set by this variable, so anything 
           lower than 30px might make the text to go outside the tab area.

           With compact mode enabled on Nova, the min value to not cause issues you should be using 
           for --tab-min-height is 20px.
        */

        #TabsToolbar {
            --tab-min-height: inherit !important;
        }

        /*  These below control the padding of the new tab button and min/max/close buttons respectively.
            YOU DON'T NEED TO CHANGE THESE unless you want to use values of --tab-min-height lower than 20px.
            Before changing them, you need to UNCOMMENT the 2 rules below for them TO TAKE EFFECT.

            The first rule (#TabsToolbar) controls the padding around the "new tab" button. Make sure to always use "px"
            as unit for it to work, even on 0 value. Reducing it will allow a lower limit on the tabs height.

            The second rule (.titlebar-buttonbox) has paddings control the padding of the min/max/close buttons.
            Changing these are required if you want the tab bar to be smaller when having 1 row. */

        #TabsToolbar {
            --toolbarbutton-inner-padding: inherit !important;
        }

        /* Sizing of the titlebar buttons */
        .titlebar-buttonbox {
            height: var(--tab-min-height) !important;
        }

        /*-------- Don't edit past here unless you know what you are doing --------*/

        /* These 2 rules are a fix to make sure that tabs become smaller on smaller --tab-min-height values */
        .tabbrowser-tab {
            max-height: calc(var(--tab-min-height) + var(--toolbarbutton-inner-padding)) !important;
        }

        .toolbar-items {-moz-box-align: start !important}

        /* Common multirow code */
        #navigator-toolbox:-moz-lwtheme {
            background-color: var(--toolbar-bgcolor) !important;
        }

        :root[lwtheme-image] #navigator-toolbox {background-repeat: repeat-y !important}

        .tabbrowser-tab:not([pinned]) {
            flex-grow: var(--tab-growth) !important}

        #tabbrowser-tabs .tab-background, #tabbrowser-tabs .tabbrowser-tab {
            min-height: var(--tab-min-height) !important}

        #nav-bar {box-shadow: none !important}

        .tab-stack {width: 100%}

        @media (-moz-platform: windows-win10), (-moz-platform: windows-win11) {
            #TabsToolbar .titlebar-buttonbox-container {display: block}

            #window-controls > toolbarbutton {
                max-height: calc(var(--tab-min-height) + 12px);
                display: inline;
            }

            #main-window[sizemode="fullscreen"] #window-controls {
                display: flex;
            }
        }

        @media (-moz-platform: windows-win7), (-moz-platform: windows-win8) {
            #tabbrowser-tabs .tabbrowser-tab {
                border-top: none !important}
        }

        /* A fix for pinned tabs triggering another row when only pinned tabs are shown in a row.
           Vertical tab bar exception: there are no rows there, so the fix is skipped and the pinned
           tabs keep the height Firefox gives them natively.
           Like the window control rules, this is gated on the root attribute kept by
           setupTabBarOrientationMarker() and not on :has(), so that the rule also applies on
           Firefox ESR115 (where :has() is not supported and the parser drops the whole rule). */
        :root[${TAB_BAR_HORIZONTAL_ATTR}] .tabbrowser-tab[pinned] {
            height: calc(var(--tab-min-height) + 12px) !important;
        }

        /* Make tab split view container not be bigger in height than the size of a tab */
        tab-split-view-wrapper {
            max-height: var(--tab-min-height) !important;
            padding: 0px !important;
        }

        /* Disable duplicated min/max/close buttons */
        #toolbar-menubar:not([inactive])~#TabsToolbar .titlebar-buttonbox-container {
            width: 0 !important;
        }

        /* This fixes issues with tab dragging */
        .tabbrowser-tab[dragtarget] {
            z-index: 1 !important;
            position: initial !important;
        }

        .tabbrowser-tab {
            left: 0 !important;
        }

        #tabbrowser-arrowscrollbox-periphery {
            transform: none !important}

        /* These fix issues with pinned tabs on the overflow status */
        #tabbrowser-tabs[overflow="true"] > #tabbrowser-arrowscrollbox > #tabs-newtab-button,
        #TabsToolbar:not([customizing="true"]) #tabbrowser-tabs[hasadjacentnewtabbutton] > #tabbrowser-arrowscrollbox > #tabs-newtab-button {
            display: inline-flex !important;
        }

        #tabs-newtab-button .new-tab-popup,
        #TabsToolbar:not([customizing="true"]) #tabbrowser-tabs[hasadjacentnewtabbutton] ~ #new-tab-button
        {display: none}

        #tabbrowser-tabs, #tabbrowser-arrowscrollbox, .tabbrowser-tab[style^="margin-inline-start"],
        #tabbrowser-tabs[positionpinnedtabs] > #tabbrowser-arrowscrollbox > .tabbrowser-tab[pinned] {
            margin-inline-start: 0 !important;
        }

        #tabbrowser-tabs[positionpinnedtabs] > #tabbrowser-arrowscrollbox > .tabbrowser-tab[pinned] {
            position: initial !important;
        }

        #tabbrowser-tabs[positionpinnedtabs] {
            padding-inline-start: 0 !important;
        }

        /* Remove duplicated min/max/close buttons.
           The button box copy inside the nav bar is a duplicate only while the horizontal
           multirow tab bar is used, because there the real controls live in #TabsToolbar.
           With the vertical tab bar Firefox moves the real window controls into the nav bar,
           so hiding that copy there was what made the minimize/maximize/close buttons disappear
           in the vertical layout. Gating the rule on the root attribute that
           setupTabBarOrientationMarker() keeps up to date hides the duplicate in the horizontal
           layout and leaves the native controls untouched in the vertical one. */
        :root[${TAB_BAR_HORIZONTAL_ATTR}] #nav-bar > .titlebar-buttonbox-container {
            display: none !important;
        }

        #TabsToolbar .titlebar-buttonbox-container {
            display: block !important;
        }

        /* Fix issues with group tabs */
        .tab-group-label-container {
            margin-inline-start: 0 !important;
        }

        `;

        if (hideAllTabs) {
            css += `#alltabs-button {display: none !important;}`
        }

        if (hideWindowControlsMenu) {
            // The minimize/maximize/close buttons are wrapped in a .titlebar-buttonbox-container,
            // and Firefox keeps a copy of it in the tabs toolbar, in the nav bar and in the menu
            // bar, showing whichever one fits the current layout. Hiding the container (and the
            // inner .titlebar-buttonbox for good measure) covers every one of those copies, so no
            // window control is left behind in either tab bar layout.
            //
            // These rules are deliberately not gated on the tab bar orientation, so the option
            // controls the window controls in the vertical tab bar layout as well instead of only
            // in the horizontal one. The buttons are shown again in the vertical layout by
            // default because the nav bar copy is no longer hidden there, see the
            // "Remove duplicated min/max/close buttons" rule above.
            //
            // They are also written without :has(). The CSS parser only knows :has() from Firefox
            // 121 on, so the ESR115 branch drops every rule that uses it without a warning, which
            // is exactly why the buttons stayed visible there. Plain selectors are understood
            // everywhere.
            //
            // A copy of this container also lives in #toolbar-menubar, which is the one Firefox
            // shows while the menu bar is visible, so hiding just the tabs toolbar copy is not
            // enough. The id selectors are what raises the specificity above the "display: block"
            // rule that the main stylesheet above applies to the tabs toolbar copy, which is
            // required for these rules to win, as both of them use !important.
            css += `
            :root :is(.titlebar-buttonbox-container, .titlebar-buttonbox),
            :root :is(#titlebar, #TabsToolbar, #toolbar-menubar, #nav-bar) :is(.titlebar-buttonbox-container, .titlebar-buttonbox) {
                display: none !important;
            }
            `

            // Firefox groups the .titlebar-spacer elements together with those containers: they are
            // the 40px wide empty drag areas it reserves in the titlebar area, which in the tabs
            // toolbar is the strip at the leading edge of the row. They are left over as empty
            // placeholders once the controls are gone.
            // The direct child combinator is what keeps this rule away from #vertical-spacer, which
            // carries the same class but is a spring inside the nav bar target instead of a titlebar item.
            css += `
            :root :is(#TabsToolbar, #nav-bar) > .titlebar-spacer {
                display: none !important;
            }
            `
        }

        if (fullWidthTabs) {
            css += `.tabbrowser-tab[fadein]:not([pinned]) {max-width: 100vw !important;}`
        }

        if (showCloseButtonOnlyOnActiveTab) {
            // Hide the close button on all non-selected tabs.
            // Uses [selected] attribute selector which is supported on ESR115 and all newer versions.
            // This also overrides the default hover behavior so the X button only ever appears
            // on the active tab. If you prefer to also show it on hover, change "display: none"
            // to "opacity: 0" and add a :hover rule that sets opacity back to 1.
            css += `
            .tabbrowser-tab:not([selected]) .tab-close-button {
                display: none !important;
            }
            `
        }

        if (tabMinWidth > 0) {
            Services.prefs.setIntPref("browser.tabs.tabMinWidth", tabMinWidth);
        } else {
            Services.prefs.clearUserPref("browser.tabs.tabMinWidth");
        }

        // We check if using australis here
        let australisElement = getComputedStyle(document.getElementsByClassName("tabbrowser-tab")[0])
                               .getPropertyValue('--svg-before-normal-density');

        if (australisElement == null) {
            australisElement = getComputedStyle(document.querySelector(":root"))
                               .getPropertyValue('--svg-selected-after');
        }

        // Here the FF71+ changes
        let style = document.createElement('style');
        let arrowScrollbox = resolveTabsContainer();

        // Fix pinned tabs past FF141+
        const pinnedTabsContainer = document.getElementById("pinned-tabs-container");
        if (pinnedTabsContainer) {
            // Make sure to migrate all pinned tabs right from the start
            migratePinnedTabs(arrowScrollbox, pinnedTabsContainer.querySelectorAll(".tabbrowser-tab"));

            // Then add a mutation observer so that any new pinned tab gets migrated
            const pinnedObserver = new MutationObserver((mutationList) => {
                // Migrate entries respecting the order they were added in
                for (const mutation of mutationList) {
                    migratePinnedTabs(arrowScrollbox, mutation.addedNodes);
                }
            });
            pinnedObserver.observe(pinnedTabsContainer, { childList: true });

            // Keep the pinned tabs in their native place while the vertical tab bar is used
            if (restorePinnedTabsOnVerticalMode) {
                setupVerticalTabsPinnedRestore(arrowScrollbox, pinnedTabsContainer);
            }
        }

        css +=
        `scrollbar, #tab-scrollbox-resizer {-moz-window-dragging: no-drag !important}

        #tabbrowser-tabs > arrowscrollbox {
            overflow: auto;
            display: block;
        `
        // For ESR115
        if (hideNewTabBtn) {
            css += `}`
        }

        // This is a fix for the shadow elements:
        style.innerHTML = `
        .scrollbox-clip {
            overflow: visible;
            display: block}

        scrollbox {
            display: flex;
            flex-wrap: wrap;
            min-height: var(--tab-min-height);
        }

        /* Firefox 131+ fix */
        scrollbox > slot {
            flex-wrap: wrap;
        }

        .arrowscrollbox-overflow-start-indicator,
        .arrowscrollbox-overflow-end-indicator {position: fixed !important}

        .scrollbutton-up, .scrollbutton-down, spacer,
        #scrollbutton-up, #scrollbutton-down {display: none !important}
        `

        // This is a fix for the tabs with icons
        if (!allowResizeWithIcon) {
            css += `
            .tabbrowser-tab:not([pinned]) {
                --tab-min-width-extra-icons: 0px !important;
            }
            `
        }

        // If the new tab button is hidden we don't apply the overflowing fix
        if (hideNewTabBtn) {
            css += `
            #tabbrowser-arrowscrollbox-periphery {
                display: none !important}
            `
            if (!version_ge("131a1")) {
                css += `
                #tabs-newtab-button {
                    display: none !important}
                `
            }
        } else {
            css += `
            /* This fixes the new tab button overflowing to the new row alone */
            #tabbrowser-arrowscrollbox-periphery {
                margin-left: -36px !important}

            .tabbrowser-tab:has(+#tabbrowser-arrowscrollbox-periphery), tab-group:has(+#tabbrowser-arrowscrollbox-periphery),
            .tab-group:has(+#tabbrowser-arrowscrollbox-periphery) > tab:last-of-type,
            tab-split-view-wrapper:has(+#tabbrowser-arrowscrollbox-periphery) {
                margin-right: 36px !important}
            `
        }

        if (australisElement) {
            css += `
            .tabbrowser-tab[first-visible-tab="true"] {
                padding-left: 0 !important;
            }
            `;

            style.innerHTML += `
            scrollbox {
                padding: 0 30px;
            }
            `;
        }

        arrowScrollbox.shadowRoot.appendChild(style);

        await loadCssChrome(css);

        // The root attribute that the window control hiding rules depend on has to be set
        // after the CSS is registered, and re-set on every tab bar orientation change.
        // Missing this call was why the controls stayed visible on ESR115 even after the
        // :has() rewrite.
        setupTabBarOrientationMarker();

        gBrowser.tabContainer._getDropIndex = function(event) {
            let tabToDropAt = getTabFromEventTarget(event, false);
            const tabPos = findDropIndexOfTab(arrowScrollbox, tabToDropAt);

            if (window.getComputedStyle(this).direction == "ltr") {
                let rect = tabToDropAt.getBoundingClientRect();
                if (event.clientX < rect.x + rect.width / 2)
                    return tabPos;
                else
                    return tabPos + 1;

            } else {
                let rect = tabToDropAt.getBoundingClientRect();
                if (event.clientX > rect.x + rect.width / 2)
                    return tabPos;
                else
                    return tabPos + 1;
            }
        };

        // We set this to check if the listeners were added before
        let listenersActive = false;

        // This sets when to apply the fix (by default a new row starts after the 23th open tab, unless you changed the min-size of tabs)
        gBrowser.tabContainer.addEventListener("dragstart", (event) => {
            const pinnedTabsCount = arrowScrollbox.querySelectorAll(".tabbrowser-tab[newPin]").length;
            draggedTabIndex = findDropIndexOfTab(arrowScrollbox, getTabFromEventTarget(event, false));
            if(gBrowser.tabContainer.arrowScrollbox.clientHeight > document.getElementsByClassName("tabbrowser-tab")[0].clientHeight || pinnedTabsCount > 0) {

                // Multiple tab select fix
                gBrowser.visibleTabs.forEach(t => t.style.transform = "");

                // Event handling
                // On older versions like ESR115 the internal drag handlers are bound via addEventListener
                // at init time, so assigning to .on_dragover/_onDragOver/ondrop properties does not replace
                // them and our custom code never runs. We instead bind our own handlers in the capture
                // phase and use stopImmediatePropagation to block the native handlers entirely, which
                // works reliably across all versions.
                // We also handle dragend/dragleave ourselves because the native cleanup code (which hides
                // the drop indicator) is also blocked by our event interception.
                if (!listenersActive) {
                    gBrowser.tabContainer.addEventListener("dragover", (dragoverEvent) => {
                        dragoverEvent.stopImmediatePropagation();
                        performTabDragOver(dragoverEvent);
                    }, true);
                    gBrowser.tabContainer.addEventListener("drop", (dropEvent) => {
                        dropEvent.stopImmediatePropagation();
                        performTabDropEvent(dropEvent);
                        // Native drop handler was blocked, manually clean up drag state and hide indicator
                        // after the move completes. Without this the indicator stays visible forever on
                        // ESR115 / all versions where we intercept native handlers.
                        clearTabDragIndicator();
                    }, true);
                    gBrowser.tabContainer.addEventListener("dragend", (dragendEvent) => {
                        // Also clean up if drag ends outside the tab bar (cancel, drag to other window)
                        clearTabDragIndicator();
                    }, true);
                    gBrowser.tabContainer.addEventListener("dragleave", (dragleaveEvent) => {
                        // If we leave the tab container entirely, hide the indicator
                        if (!gBrowser.tabContainer.contains(dragleaveEvent.relatedTarget)) {
                            clearTabDragIndicator();
                        }
                    }, true);
                    listenersActive = true;
                }
            }
        });
    }

    async function loadCssChrome(css) {
        let sss = Cc['@mozilla.org/content/style-sheet-service;1'].getService(Ci.nsIStyleSheetService);
        let uri = makeURI('data:text/css;charset=UTF=8,' + encodeURIComponent(css));
        await sss.loadAndRegisterSheet(uri, sss.AGENT_SHEET);
    }

    /**
     * Gets the tab from the event target.
     * @param {*} event The event.
     * @returns The tab if it was part of the target or its parents, otherwise null
     */
    function getTabFromEventTarget(event, { ignoreTabSides = false } = {}) {
        let { target } = event;
        if (target.nodeType != Node.ELEMENT_NODE) {
            target = target.parentElement;
        }
        let tab = target?.closest(TAB_SELECTOR) || target?.closest(TAB_GROUP_SELECTOR);
        let selectedTab = getDraggedTab(event);
        if (selectedTab.nodeName === "label") {
            selectedTab = findParentOfType(selectedTab, TAB_GROUP_SELECTOR, 3)?.querySelector("tab:first-of-type") || gBrowser.selectedTab;
        }
        if (tab && ignoreTabSides) {
            let { width, height } = tab.getBoundingClientRect();
            if (
                event.screenX < tab.screenX + width * 0.25 ||
                event.screenX > tab.screenX + width * 0.75 ||
                ((event.screenY < tab.screenY + height * 0.25 ||
                    event.screenY > tab.screenY + height * 0.75) &&
                    gBrowser.tabContainer.verticalMode)
            ) {
                return selectedTab;
            }
        }
        if (!tab) {
            return selectedTab;
        }
        return tab;
    }

    /**
     * Performs the tab drag over event.
     * @param {*} event The drag over event.
     */
    function performTabDragOver(event) {
        event.preventDefault();
        event.stopPropagation();

        let ind = gBrowser.tabContainer.getElementsByClassName("tab-drop-indicator")[0];

        let effects = orig_getDropEffectForTabDrag(event);
        let tab;
        if (effects == "link") {
            tab = getTabFromEventTarget(event, true);
            if (tab) {
                if (!gBrowser.tabContainer._dragTime)
                    gBrowser.tabContainer._dragTime = Date.now();
                if (!tab.hasAttribute("pendingicon") && // annoying fix
                    Date.now() >= gBrowser.tabContainer._dragTime + gBrowser.tabContainer._dragOverDelay)
                    gBrowser.tabContainer.selectedItem = tab;
                ind.hidden = true;
                return;
            }
        }

        if (!tab) {
            tab = getTabFromEventTarget(event, false);
        }

        let dropIndex = gBrowser.tabContainer._getDropIndex(event);
        if (dropIndex == null)
            return;

        let tabs = gBrowser.tabContainer.querySelectorAll(TAB_SELECTOR);
        let draggedTab = getDraggedTab(event);
        let draggedGroup = findParentOfType(draggedTab, TAB_GROUP_SELECTOR, 3);

        if (!tab)
            tab = getTabFromEventTarget(event, false);

        // Handle drop index on tab label
        if (tab.nodeName === TAB_GROUP_SELECTOR) {
            groupToInsertTo = tab;
            positionInGroup = 0;

            // Make the dragged tab go to the end of the group if it's a regular tab
            if (draggedTab?.nodeName === TAB_SELECTOR) {
                let groupEnd = Array.prototype.indexOf.call(tabs, tab.querySelector("tab:last-of-type")) + 1;
                // We can't rely on dropIndex here, so we gotta calculate the index using the group absolute positions
                positionInGroup = -1;
                dropIndex = groupEnd;
            }
        }

        // Update the last known group position
        else if (tab.parentNode.nodeName === TAB_GROUP_SELECTOR) {
            groupToInsertTo = tab.parentNode;
            let groupStart = tab.parentNode.querySelector("tab:first-of-type");
            positionInGroup = dropIndex - Array.prototype.indexOf.call(tabs, groupStart);
        } else {
            groupToInsertTo = null;
            positionInGroup = null;
        }

        // Move the tab to the last position if it's moved to an empty area of the tab box
        // Use composedPath to account for ESR115 where arrowScrollbox uses a shadow DOM,
        // so the event target can be an internal shadow element (scrollbox, scrollbox-clip)
        // instead of arrowScrollbox itself when the user drags onto empty space.
        const eventPath = event.composedPath();
        const dragTargetIsInsideScrollArea = eventPath.some(el =>
            el === gBrowser.tabContainer.arrowScrollbox ||
            el === gBrowser.tabContainer.newTabButton
        );
        const dragTargetIsOnTab = eventPath.some(el =>
            el.nodeName && (el.nodeName === TAB_SELECTOR || el.nodeName === TAB_GROUP_SELECTOR)
        );
        if (dragTargetIsInsideScrollArea && !dragTargetIsOnTab)
            dropIndex = gBrowser.tabs.length;

        let ltr = (window.getComputedStyle(gBrowser.tabContainer).direction == "ltr");
        let rect = gBrowser.tabContainer.arrowScrollbox.getBoundingClientRect();
        let newMarginX, newMarginY;

        // Update the tab drop position (different from the drop indicator due to tab groups)
        lastKnownIndex = dropIndex;

        if (dropIndex == tabs.length) {
            let tabRect = tabs[dropIndex - 1].getBoundingClientRect();
            if (ltr)
                newMarginX = tabRect.right - rect.left;
            else
                newMarginX = rect.right - tabRect.left;
            newMarginY = tabRect.top + tabRect.height - rect.top - rect.height; // multirow fix

            if (CSS.supports("offset-anchor", "left bottom")) // Compatibility fix for FF72+
                newMarginY += rect.height / 2 - tabRect.height / 2;

        } else if (dropIndex != null || dropIndex != 0) {
            let tabRect = tabs[dropIndex].getBoundingClientRect();
            let tabLeft = tabRect.left;
            let tabRight = tabRect.right;
            let tabHeight = tabRect.height;
            let tabTop = tabRect.top;

            // Handle drop index position when hovering over a group label
            let tabGroup = tab.nodeName === TAB_GROUP_SELECTOR ? tab : tab.parentNode;
            if (draggedTab?.nodeName === "label" && tabGroup?.nodeName === TAB_GROUP_SELECTOR) {
                let tabRect;
                let draggedIndex = Array.prototype.indexOf.call(tabs, draggedGroup.querySelector("tab:first-of-type"));
                let groupStart = Array.prototype.indexOf.call(tabs, tabGroup.querySelector("tab:first-of-type"));
                let groupEnd = Array.prototype.indexOf.call(tabs, tabGroup.querySelector("tab:last-of-type")) + 1;
                let groupSize = groupEnd - groupStart;

                if (positionInGroup < groupSize / 2 && draggedIndex !== groupStart) {
                    tabRect = tabGroup.childNodes[0].getBoundingClientRect();
                    tabLeft = tabRect.left;
                } else {
                    tabRect = tabGroup.querySelector("tab:last-of-type").getBoundingClientRect();
                    tabLeft = tabRect.right;
                }

                tabTop = tabRect.top;
                tabRight = tabRect.right;
                tabHeight = tabRect.height;
            } else {
                let draggingGroupToAnotherGroup = groupToInsertTo === tab && draggedTab?.nodeName === "label";
                let draggingBeforeGroup = tab.nodeName === TAB_SELECTOR && tab.parentNode.nodeName !== TAB_GROUP_SELECTOR
                    && tabs[dropIndex].parentNode.nodeName === TAB_GROUP_SELECTOR
                    && tabs[dropIndex].parentNode !== draggedGroup;
                let groupToCheck = groupToInsertTo
                if (tabs[dropIndex].parentNode.nodeName === TAB_GROUP_SELECTOR)
                    groupToCheck = tabs[dropIndex].parentNode;
                let draggingAfterConsecutiveGroup = groupToInsertTo !== groupToCheck && tabGroup == groupToInsertTo;
                if (draggingGroupToAnotherGroup || draggingBeforeGroup || draggingAfterConsecutiveGroup) {

                    let tabRect = groupToCheck.childNodes[0].getBoundingClientRect();
                    tabLeft = tabRect.left;
                    tabTop = tabRect.top;
                    tabRight = tabRect.right;
                    tabHeight = tabRect.height;
                }
            }

            if (ltr)
                newMarginX = tabLeft - rect.left;
            else
                newMarginX = rect.right - tabRight;
            newMarginY = tabTop + tabHeight - rect.top - rect.height; // multirow fix

            if (CSS.supports("offset-anchor", "left bottom")) // Compatibility fix for FF72+
                newMarginY += rect.height / 2 - tabHeight / 2;
        }

        newMarginX += ind.clientWidth / 2;
        if (!ltr)
            newMarginX *= -1;

        ind.hidden = false;

        ind.style.transform = "translate(" + Math.round(newMarginX) + "px," + Math.round(newMarginY) + "px)"; // multirow fix
        ind.style.marginInlineStart = (-ind.clientWidth) + "px";
    }

    /**
     * Compatibility layer for tab moving: use native moveTabBefore/moveTabAfter on new
     * Firefox versions, fall back to legacy moveTabTo(tab, index) on older versions
     * (like ESR115) where these methods don't exist.
     * @param {Element} tab The tab to move.
     * @param {Element} targetTab The reference tab to move relative to.
     * @param {boolean} after If true, move after the target tab; otherwise before.
     */
    function moveTabRelativeTo(tab, targetTab, after = false) {
        // New versions with native APIs: use them directly
        if (typeof gBrowser.moveTabBefore === "function" && typeof gBrowser.moveTabAfter === "function") {
            if (after) {
                gBrowser.moveTabAfter(tab, targetTab);
            } else {
                gBrowser.moveTabBefore(tab, targetTab);
            }
            return;
        }
        // Legacy versions (ESR115): use moveTabTo by calculating target index
        if (!targetTab || !targetTab._tPos) {
            // Moving to end
            gBrowser.moveTabTo(tab, gBrowser.tabs.length - 1);
            return;
        }
        let targetIndex = targetTab._tPos;
        if (after) {
            targetIndex += 1;
        }
        // Adjust index if we're moving the tab from before the target to after,
        // to avoid off-by-one errors (moving a tab later in the list shifts positions)
        if (tab._tPos < targetIndex) {
            targetIndex -= 1;
        }
        gBrowser.moveTabTo(tab, Math.max(0, Math.min(targetIndex, gBrowser.tabs.length - 1)));
    }

    /**
     * Clears the tab drag indicator and resets drag state.
     * On new Firefox versions the native _finishDrop does this, but on ESR115 (and all
     * versions where we intercept native drag handlers) we need to do it ourselves
     * after drop/dragend to avoid the indicator staying visible permanently.
     */
    function clearTabDragIndicator() {
        const ind = gBrowser.tabContainer.getElementsByClassName("tab-drop-indicator")[0];
        if (ind) {
            ind.hidden = true;
            ind.style.transform = "";
            ind.style.marginInlineStart = "";
        }
        // Reset internal drag state flags
        if (gBrowser.tabContainer._dragTime) {
            gBrowser.tabContainer._dragTime = null;
        }
        if (gBrowser.tabContainer._dragOverDelay) {
            // Don't delete, just reset state that depends on time
        }
        // Reset our own global tracking vars
        lastKnownIndex = null;
        groupToInsertTo = null;
        positionInGroup = null;
        // Reset selected tab transforms from multi-select drag
        gBrowser.visibleTabs.forEach(t => t.style.transform = "");
    }

    /**
     * Compatibility check for whether a node is a tab element. Works on all Firefox
     * versions including ESR115 where gBrowser.isTab does not exist.
     * @param {Node} node The node to check.
     * @returns {boolean} True if the node is a browser tab.
     */
    function isTabNode(node) {
        if (typeof gBrowser.isTab === "function") {
            return gBrowser.isTab(node);
        }
        // Legacy detection for ESR115: tab elements are <tab class="tabbrowser-tab">
        return node?.nodeType === Node.ELEMENT_NODE &&
               node.localName === "tab" &&
               node.classList?.contains("tabbrowser-tab");
    }

    /**
     * Compatibility check for whether a node is a tab group label. Always returns false
     * on ESR115, which does not have native tab groups.
     * @param {Node} node The node to check.
     * @returns {boolean} True if the node is a tab group label.
     */
    function isTabGroupLabelNode(node) {
        if (typeof gBrowser.isTabGroupLabel === "function") {
            return gBrowser.isTabGroupLabel(node);
        }
        // ESR115 has no native tab groups, this never matches
        return false;
    }

    /**
     * Performs the tab drop event.
     * @param {*} event The drop event.
     */
    function performTabDropEvent(event) {
        let newIndex;
        let dt = event.dataTransfer;
        let dropEffect = dt.dropEffect;
        let draggedTab = getDraggedTab(event);
        const tabsContainer = resolveTabsContainer();
        const allTabs = tabsContainer.querySelectorAll(TAB_SELECTOR);

        // Handle moving tab groups
        let tabGroup = findParentOfType(draggedTab, TAB_GROUP_SELECTOR, 3);
        if (draggedTab.nodeName === "label" && tabGroup) {
            let tabToMoveTo = allTabs[lastKnownIndex];
            let draggedIndex = Array.prototype.indexOf.call(allTabs, tabGroup.querySelector("tab:first-of-type"));
            if (draggedIndex === lastKnownIndex)
                return;
            if (groupToInsertTo) {
                let groupStart = Array.prototype.indexOf.call(allTabs, groupToInsertTo.querySelector("tab:first-of-type"));
                let groupEnd = Array.prototype.indexOf.call(allTabs, groupToInsertTo.querySelector("tab:last-of-type"));
                let groupSize = groupEnd - groupStart;
                // Skip group move logic on ESR115 (no native tab groups exist)
                if (typeof gBrowser.moveTabBefore === "function") {
                    if (positionInGroup < groupSize / 2)
                        gBrowser.moveTabBefore(tabGroup, groupToInsertTo);
                    else
                        gBrowser.moveTabAfter(tabGroup, groupToInsertTo);
                }
            } else if (lastKnownIndex !== allTabs.length)
                moveTabRelativeTo(tabGroup, tabToMoveTo, false);
            else
                moveTabRelativeTo(tabGroup, allTabs[lastKnownIndex - 1], true);
        }
        // Handle moving regular tabs
        else if (draggedTab && dropEffect != "copy" && draggedTab.container == gBrowser.tabContainer) {
            if (lastKnownIndex > allTabs.length)
                lastKnownIndex = allTabs.length;
            newIndex = lastKnownIndex;

            // Perform the actual moving of tabs
            moveSelectedTabs(newIndex, tabsContainer, event);

            // Restart global vars
            lastKnownIndex = null;
            groupToInsertTo = null;
            positionInGroup = null;
        }
    }

    /**
     * Moves the selected tabs to a new index.
     * @param {*} newIndex The new index to move tabs to.
     * @param {*} tabsContainer The tabs container where tabs are.
     * @param {*} event The drop event.
     */
    function moveSelectedTabs(newIndex, tabsContainer, event) {
        /* fix for moving multiple selected tabs and tab groups */
        let selectedTabs = gBrowser.selectedTabs.filter(t => t != null);

        let pinnedTabsCount = tabsContainer.querySelectorAll(".tabbrowser-tab[newPin]").length;

        // Dropping a tab between the pinned tabs. With the native dragging behaviour kept this
        // must not pin the tab, so that drop is handled as a regular tab move instead
        let droppedOnPinnedTabs = newIndex >= 0 && newIndex < pinnedTabsCount;
        let pinOnDrop = droppedOnPinnedTabs && !keepNativeTabDragBehavior;

        // Pin the tab if it wasn't pinned
        if (pinOnDrop) {
            selectedTabs.forEach(t => {
                if (newIndex > draggedTabIndex) {
                    newIndex--;
                }

                if (t.pinned) {
                    gBrowser.unpinTab(t);
                }

                gBrowser.pinTab(t);
                migratePinnedTabs(tabsContainer, document.querySelectorAll("#pinned-tabs-container .tabbrowser-tab"));
                setTimeout(() => {
                    const tab = tabsContainer.querySelector(`.tabbrowser-tab[newPin]:nth-child(${tabsContainer.querySelectorAll("tab[newPin]").length})`);
                    const tabToMoveAt = tabsContainer.childNodes[newIndex];
                    if (tabToMoveAt == null)
                        tabsContainer.insertBefore(tab, document.getElementById("tabbrowser-arrowscrollbox-periphery"));
                    else
                        tabsContainer.insertBefore(tab, tabToMoveAt);
                }, 10);
            });
        // Handle moving tabs to a group
        } else if (groupToInsertTo) {
            moveTabsToGroup(selectedTabs, event);

        // Handle regular tab moving
        } else {
            let allTabs = tabsContainer.querySelectorAll(TAB_SELECTOR);
            // Move the tab to the last position if it's moved to an empty area of the tab box.
            // Use composedPath for compatibility with ESR115, where arrowScrollbox uses a
            // shadow DOM so event.target will be an internal shadow element instead of the
            // arrow scrollbox itself when dragging over empty space.
            const dropEventPath = event.composedPath();
            const dropTargetIsInsideScrollArea = dropEventPath.some(el =>
                el === gBrowser.tabContainer.arrowScrollbox ||
                el === gBrowser.tabContainer.newTabButton
            );
            const dropTargetIsOnTab = dropEventPath.some(el =>
                el.nodeName && (el.nodeName === TAB_SELECTOR || el.nodeName === TAB_GROUP_SELECTOR)
            );
            if (dropTargetIsInsideScrollArea && !dropTargetIsOnTab) {
                newIndex = allTabs.length;
            }

            let tabToMoveTo = allTabs[newIndex];
            let shouldMoveAfter = tabToMoveTo?.parentNode.nodeName === TAB_GROUP_SELECTOR;
            let shouldUngroup = false;
            if (!tabToMoveTo && allTabs[newIndex - 1]) {
                tabToMoveTo = allTabs[newIndex - 1];
                shouldMoveAfter = true;
                shouldUngroup = true;
            }
            if (shouldMoveAfter)
                tabToMoveTo = allTabs[newIndex - 1];

            selectedTabs.forEach(t => {
                let tabWasPinned = t.hasAttribute("newPin");

                // A pinned tab dropped between the pinned tabs just keeps its pinned state
                let staysPinned = tabWasPinned && droppedOnPinnedTabs;

                if (t.hasAttribute("newPin") && !staysPinned) {
                    if (t.pinned) {
                        gBrowser.unpinTab(t)
                    }
                    t.removeAttribute("newPin");
                }

                // A tab that is already pinned can only be pinned again when it lands right
                // after the pinned tabs, and with the native dragging behaviour kept a dragged
                // regular tab is never turned into a pinned tab. The old condition for a
                // regular tab is kept as it was (negative drop indexes included)
                let shouldPinTab = staysPinned ||
                    (tabWasPinned && newIndex == pinnedTabsCount) ||
                    (!keepNativeTabDragBehavior && !tabWasPinned && newIndex < pinnedTabsCount);

                if (shouldPinTab && !staysPinned) {
                    gBrowser.pinTab(t)
                    migratePinnedTabs(tabsContainer, document.querySelectorAll("#pinned-tabs-container .tabbrowser-tab"));
                }

                if (!shouldMoveAfter)
                    moveTabRelativeTo(t, tabToMoveTo, false);
                else
                    moveTabRelativeTo(t, tabToMoveTo, true);

                if (shouldUngroup)
                    gBrowser.ungroupTab(t);
            });
        }
    }

    // copy of the original and overrided _getDropEffectForTabDrag method
    function orig_getDropEffectForTabDrag(event) {
        let dt = event.dataTransfer;

        let isMovingTabs = dt.mozItemCount > 0;
        for (let i = 0; i < dt.mozItemCount; i++) {
            // tabs are always added as the first type
            let types = dt.mozTypesAt(0);
            if (types[0] != TAB_DROP_TYPE) {
                isMovingTabs = false;
                break;
            }
        }

        if (isMovingTabs) {
            let sourceNode = dt.mozGetDataAt(TAB_DROP_TYPE, 0);
            if (version_ge("160a1")) {
                // Assume we are using firefox above 160
                const { isTab, isTabGroupLabel, isSplitViewWrapper } = Tabbrowser;
                usingNewerVersion = false;
                if (
                    (isTab(sourceNode) ||
                    isTabGroupLabel(sourceNode) ||
                    isSplitViewWrapper(sourceNode)) &&
                    sourceNode.documentGlobal.isChromeWindow &&
                    sourceNode.ownerDocument.documentElement.getAttribute("windowtype") ==
                    "navigator:browser"
                ) {
                    // Do not allow transfering a private tab to a non-private window
                    // and vice versa.
                    if (PrivateBrowsingUtils.isWindowPrivate(window) !=
                    PrivateBrowsingUtils.isWindowPrivate(sourceNode.documentGlobal)) {
                        return "none";
                    }
                
                    if (window.gMultiProcessBrowser !=
                    sourceNode.documentGlobal.gMultiProcessBrowser) {
                        return "none";
                    }
                
                    if (window.gFissionBrowser != sourceNode.documentGlobal.gFissionBrowser) {
                        return "none";
                    }
                }
            } else {
                // Assume we are using FF159 or older
                let nodeOwnerGlobal = sourceNode.ownerGlobal;
                if (!nodeOwnerGlobal)
                    nodeOwnerGlobal = sourceNode.documentGlobal;
                if ((isTabNode(sourceNode) || isTabGroupLabelNode(sourceNode)) &&
                    nodeOwnerGlobal.isChromeWindow &&
                    sourceNode.ownerDocument.documentElement.getAttribute("windowtype") ==
                    "navigator:browser") {
                    // Do not allow transfering a private tab to a non-private window
                    // and vice versa.
                    if (PrivateBrowsingUtils.isWindowPrivate(window) !=
                        PrivateBrowsingUtils.isWindowPrivate(nodeOwnerGlobal))
                        return "none";
            
            
                    if (window.gMultiProcessBrowser !=
                        nodeOwnerGlobal.gMultiProcessBrowser)
                        return "none";
            
            
                    if (window.gFissionBrowser != nodeOwnerGlobal.gFissionBrowser)
                        return "none";
                }
            }
            return dt.dropEffect == "copy" ? "copy" : "move";
        }

        if (Services.droppedLinkHandler.canDropLink(event, true))
            return "link";

        return "none";
    }

    /**
     * The pinned tabs to migrate to the main container.
     * @param {Array<Tab>} pinnedTabs The pinned tabs.
     */
    function migratePinnedTabs(newContainer, pinnedTabs) {
        if (!pinnedTabs || pinnedTabs.length == 0)
            return;

        // With the vertical tab bar the pinned tabs must stay in the pinned tabs container,
        // otherwise Firefox stops showing them as collapsed pinned tabs
        if (isVerticalTabsMode())
            return;

        for (let i = 0; i < pinnedTabs.length; i++) {
            let tab = pinnedTabs[i]
            if (!tab.matches || !tab.matches(".tabbrowser-tab"))
                continue;
            tab.setAttribute("newPin", "true");
            let firstUnpinnedTab = newContainer.querySelector(".tabbrowser-tab:not([pinned])");
            if (firstUnpinnedTab) {
                let tabGroup = findParentOfType(firstUnpinnedTab, TAB_GROUP_SELECTOR);
                if (tabGroup)
                    firstUnpinnedTab = tabGroup
                newContainer.insertBefore(tab, firstUnpinnedTab);
            } else
                newContainer.insertBefore(tab, document.getElementById("tabbrowser-arrowscrollbox-periphery"));
        }
    }

    /**
     * Checks if the tabs are currently shown in the vertical tab bar.
     * @returns {boolean} True if the vertical tab bar is being used.
     */
    function isVerticalTabsMode() {
        // Firefox marks the vertical tab strip with orient="vertical" on the tabs container
        const tabsContainer = document.getElementById("tabbrowser-tabs");
        const orient = tabsContainer?.getAttribute("orient");
        if (orient) {
            return orient === "vertical";
        }

        // Some versions only reflect the state on the tab container itself
        const tabContainer = gBrowser.tabContainer;
        if (typeof tabContainer?.verticalMode === "boolean") {
            return tabContainer.verticalMode;
        }

        // Last resort: the preference that turns the vertical tab bar on
        return Services.prefs.getBoolPref("sidebar.verticalTabs", false);
    }

    /**
     * Mirrors the orientation of the tab bar onto the root element.
     *
     * The rules that hide the window controls used to be gated on :has(), which only Firefox 121
     * and newer understand (the ESR115 branch is based on 115, where the parser drops such a
     * selector and with it the whole rule, without any warning). A plain attribute on the root
     * element says the same thing and is understood by every supported version.
     *
     * On versions without a vertical tab bar (ESR115) the tabs container carries no orient
     * attribute at all (orient="horizontal" sits on the inner arrowscrollbox instead), so a
     * missing attribute means the horizontal multirow tab bar.
     */
    function setupTabBarOrientationMarker() {
        const root = document.documentElement;
        const tabsContainer = document.getElementById("tabbrowser-tabs");

        const syncTabBarOrientation = () => {
            const orient = tabsContainer?.getAttribute("orient");
            const isHorizontal = orient ? orient !== "vertical" : !isVerticalTabsMode();
            root.toggleAttribute(TAB_BAR_HORIZONTAL_ATTR, isHorizontal);
        };

        syncTabBarOrientation();

        if (!tabsContainer)
            return;

        // Follow the changes of the tab bar orientation, so the window controls come back while
        // the vertical tab bar is used, like they do natively
        const tabBarOrientationObserver = new MutationObserver(syncTabBarOrientation);
        tabBarOrientationObserver.observe(tabsContainer, {
            attributes: true,
            attributeFilter: ["orient", "vertical"],
        });
    }

    /**
     * Moves the pinned tabs that were migrated into the tabs container back to the pinned
     * tabs container, restoring the state (and look) Firefox gives them natively.
     * @param {*} pinnedTabsContainer The native pinned tabs container.
     */
    function restorePinnedTabs(pinnedTabsContainer) {
        if (!pinnedTabsContainer)
            return;

        const migratedTabs = Array.from(document.querySelectorAll(".tabbrowser-tab[newPin]"));
        if (migratedTabs.length == 0)
            return;

        // Map every tab to its position in the tab order, so the pinned tabs can be
        // put back in the same order they had before being migrated
        const tabIndexes = new Map();
        for (const tab of gBrowser.tabs) {
            tabIndexes.set(tab, tabIndexes.size);
        }

        const getTabIndex = (tab) => tabIndexes.get(tab) ?? -1;
        migratedTabs.sort((a, b) => getTabIndex(a) - getTabIndex(b));

        for (const tab of migratedTabs) {
            const tabIndex = getTabIndex(tab);
            const nextTab = Array.from(pinnedTabsContainer.querySelectorAll(".tabbrowser-tab"))
                                 .find(t => getTabIndex(t) > tabIndex);

            pinnedTabsContainer.insertBefore(tab, nextTab || null);
            tab.removeAttribute("newPin");
        }
    }

    /**
     * Watches the tab bar orientation, so the pinned tabs go back to their native position
     * (and look) while the vertical tab bar is being used, and get migrated back into the
     * tabs container once the horizontal multirow tab bar is used again.
     * @param {*} arrowScrollbox The tabs container used by the multirow layout.
     * @param {*} pinnedTabsContainer The native pinned tabs container.
     */
    function setupVerticalTabsPinnedRestore(arrowScrollbox, pinnedTabsContainer) {
        const tabsContainer = document.getElementById("tabbrowser-tabs");
        if (!tabsContainer)
            return;

        let wasVertical = isVerticalTabsMode();

        const syncPinnedTabs = () => {
            const isVertical = isVerticalTabsMode();
            if (isVertical) {
                // Give the pinned tabs back to Firefox so they stay collapsed
                restorePinnedTabs(pinnedTabsContainer);
            } else if (wasVertical) {
                // Horizontal multirow tab bar again, so pinned tabs have to be migrated again
                migratePinnedTabs(arrowScrollbox, pinnedTabsContainer.querySelectorAll(".tabbrowser-tab"));
            }
            wasVertical = isVertical;
        };

        const verticalTabsObserver = new MutationObserver(syncPinnedTabs);
        verticalTabsObserver.observe(tabsContainer, {
            attributes: true,
            attributeFilter: ["orient", "vertical"],
        });
    }

    /**
     * Returns the current tabs container.
     * @returns {Arrowscrollbox} The arrow scrollbox that contains tabs.
     */
    function resolveTabsContainer() {
        let arrowScrollbox = document.querySelector("#tabbrowser-tabs > arrowscrollbox");
        const newScrollbox = document.getElementById("tabbrowser-arrowscrollbox");
        if (newScrollbox) {
            arrowScrollbox = newScrollbox;
        }

        return arrowScrollbox;
    }

    /**
     * Moves a set of tabs to a group.
     * @param {*} selectedTabs The tabs to move to the group.
     * @param {*} event The drop event.
     */
    function moveTabsToGroup(selectedTabs, event) {
        let tabInGroupToMoveTo = groupToInsertTo.querySelector(`tab:nth-of-type(${positionInGroup + 1})`);

        selectedTabs.forEach(t => {
            if (t.hasAttribute("newPin")) {
                t.removeAttribute("newPin");
            }
            // Only run group move logic if native group APIs exist (not available on ESR115)
            if (typeof gBrowser.moveTabToExistingGroup !== "function") {
                return;
            }
            gBrowser.moveTabToExistingGroup(t, groupToInsertTo);

            if (event.target === gBrowser.tabContainer.arrowScrollbox || event.target == gBrowser.tabContainer.newTabButton) {
                gBrowser.moveTabAfter(t, groupToInsertTo);
                gBrowser.ungroupTab(t);
            } else if (tabInGroupToMoveTo) {
                gBrowser.moveTabBefore(t, tabInGroupToMoveTo);
            } else {
                gBrowser.moveTabAfter(t, groupToInsertTo.querySelector("tab:last-of-type"));
            }
        });
    }

    /**
     * Finds the index of a tab in a parent container.
     * @param {*} tabsContainer The parent container with all tabs.
     * @param {*} tab The tab to calculate the position of.
     * @returns The index of the tab inside the parent container.
     */
    function findDropIndexOfTab(tabsContainer, tab) {
        return Array.prototype.indexOf.call(tabsContainer.querySelectorAll(TAB_SELECTOR), tab)
    }

    /**
     * Checks if the element is a child of the specified node type.
     * @param {*} element The element to check the parents.
     * @param {*} nodeName The node type to check.
     * @param {number} maxDepth The max depth of the parents to check of the element.
     * @returns The parent node of the given type if it exists.
     */
    function findParentOfType(element, nodeName, maxDepth = 5) {
        let depth = 0;
        while (depth < maxDepth) {
            depth++;
            element = element.parentNode;
            if (element.nodeName === nodeName)
                return element;
        }
        return null;
    }

    /**
     * Gets the currently dragged tab.
     * @param {Event} event The drag event.
     * @returns The dragged tab.
     */
    function getDraggedTab(event) {
        let draggedTab;
        let dt = event.dataTransfer;
        if (dt.mozTypesAt(0)[0] == TAB_DROP_TYPE) {
            draggedTab = dt.mozGetDataAt(TAB_DROP_TYPE, 0);
            if (!draggedTab) {
                return null;
            }
        }
        return draggedTab;
    }

    /* Don't remove the event listener for the main method */
    // The loader chain (autoconfig -> cfg on window load -> userChrome.js synchronously
    // loads all .uc.js files) may inject this script either before or after the window's
    // own load event, depending on cold/warm start and platform (caches, session restore,
    // font/extension init, the loader's own non-win forced sort, etc.). `load` dispatches
    // exactly once per document and never replays; a listener registered after dispatch
    // will silently never fire. Therefore we branch on document.readyState:
    //   - "complete" means load has already (or is about to) fire -> run now.
    //   - "interactive"/"loading" means load is still ahead of us -> wait for it.
    if (document.readyState === "complete") {
        await zzzz_MultiRowTabLite();
    } else {
        window.addEventListener("load", async () => {
            await zzzz_MultiRowTabLite();
        }, { once: true, capture: false });
    }
})();

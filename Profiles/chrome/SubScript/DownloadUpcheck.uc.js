// ==UserScript==
// @name            DownloadUpcheck.uc.js
// @author          Ryan, benzBrake
// @long-description
// @description
// 下载增强脚本，修改整合自（w13998686967、ywzhaiqi、黒仪大螃蟹、Alice0775、紫云飞），已重写代码。
// 相关 about:config 选项 修改后请重启浏览器，不支持热重载
// userChromeJS.downloadPlus.flashgotDownloadManagers 下载器列表缓存（一般不需要修改)
// userChromeJS.downloadPlus.flashgotDefaultManager 默认第三方下载器（一般不需要修改）
// userChromeJS.downloadPlus.enableDoubleClickToCopyLink 下载对话框双击复制链接
// userChromeJS.downloadPlus.enableCopyLinkButton 下载对话框启用复制链接按钮
// userChromeJS.downloadPlus.enableDoubleClickToSave 双击保存
// userChromeJS.downloadPlus.enableSaveAndOpen 下载对话框启用保存并打开
// userChromeJS.downloadPlus.enableSaveAs 下载对话框启用另存为
// userChromeJS.downloadPlus.enableSaveTo 下载对话框启用保存到
// userChromeJS.downloadPlus.showAllDrives 下载对话框显示所有驱动器

// @note            20251102 支持接管Iceweasel浏览器下载而不用弹出下载窗口. by adonais
// @note            20251101 支持 Iceweasel l10n, 此脚本不再适用于firefox. by adonais
// @note            20251031 修改代码, 支持Upcheck而不是flashgot, Upcheck支持Aria2 RPC. by adonais
// @note            20251030 移除了一些旧代码以及图标样式, 使下载窗口更整洁. by adonais
// @note            20250827 修复 Fx143 菜单图标的问题
// @note            20250827 修复选择 FlashGot 后点击保存文件无效的问题
// @note            20250826 禁止快速保存后会自动打开文文件，感谢@Cloudy901
// @note            20250802 修复 Fx140 dropmarker 显示异常, 强制弹出下载对话框
// @note            20250620 修复按钮和弹出菜单的一些问题
// @note            20250610 Fx139
// @note            20250509 修复文件名无效字符导致下载失败的问题，简化几处 locationText 的调用
// @note            20250501 修复下载文件改名失效
// @note            20250319 增加复制按钮开关pref，
// @note            20250226 正式进入无 JSM 时代，永久删除文件功能未集成，请使用 removeFileFromDownloadManager.uc.js，下载规则暂时也不支持
// @include         main
// @sandbox         true
// @include         chrome://browser/content/places/places.xhtml
// @include         chrome://mozapps/content/downloads/unknownContentType.xhtml
// @include         chrome://browser/content/downloads/contentAreaDownloadsView.xhtml
// @include         chrome://browser/content/downloads/contentAreaDownloadsView.xhtml?SM
// @include         about:downloads
// @version         1.0.6
// @compatibility   Firefox 139
// @homepageURL     https://github.com/benzBrake/FirefoxCustomize/Firefox-downloadPlus.uc.js
// ==/UserScript==
(async function (globalCSS, placesCSS, unknownContentCSS) {

    const lazy = {};
    let { classes: Cc, interfaces: Ci, utils: Cu, results: Cr } = Components;
    const Services = globalThis.Services;
    const Downloads = globalThis.Downloads || ChromeUtils.importESModule("resource://gre/modules/Downloads.sys.mjs").Downloads;
    const ctypes = globalThis.ctypes || ChromeUtils.importESModule("resource://gre/modules/ctypes.sys.mjs").ctypes;
    const {upcheck} = ChromeUtils.importESModule('resource://gre/modules/upcheck.sys.mjs');
    ChromeUtils.defineLazyGetter(lazy, 'L10n', () => {
        return new Localization(["branding/brand.ftl", "browser/preferences/preferences.ftl"], true);
    });
    ChromeUtils.defineESModuleGetters(this, {
        DownloadsCommon: "moz-src:///browser/components/downloads/DownloadsCommon.sys.mjs",
        DownloadHistory: "resource://gre/modules/DownloadHistory.sys.mjs",
    });
    const
    [
        downloadplusbtn,
        download_enhance_click,
        reload_download_managers,
        reload_download_finish,
        download_through_upcheck,
        download_by_default,
        default_download_manager,
        default_download_auto,
        aria2_webui,
        file_not_found,
        about_download_plus,
        added_download,
        original_name,
        encoding_convert_tooltip,
        complete_link,
        copy_link,
        be_copied,
        dobule_click_to_copy,
        save_and_open,
        save_as,
        save_to,
        this_desktop,
        downloads_folder,
        disk_x,
    ] = lazy.L10n.formatValuesSync(
    [
        'downloadplusbtn',
        'download_enhance_click',
        'reload_download_managers',
        'reload_download_finish',
        'download_through_upcheck',
        'download_by_default',
        'default_download_manager',
        'default_download_auto',
        'mouse_gestures_aria2_webui',
        'file_not_found',
        'about_download_plus',
        'added_download',
        'original_name',
        'encoding_convert_tooltip',
        'complete_link',
        'copy_link',
        'be_copied',
        'dobule_click_to_copy',
        'save_and_open',
        'save_as',
        'save_to',
        'this_desktop',
        'downloads_folder',
        'disk_x',
    ]);

    const invalidChars = /[<>:"/\\|?*]/g;

    const versionGE = (v) => {
        return Services.vc.compare(Services.appinfo.version, v) >= 0;
    }

    const processCSS = (css) => {
        if (versionGE("143a1")) {
            css = `#DownloadPlus-Btn { list-style-image: var(--menuitem-icon); }\n` + css.replaceAll('list-style-image', '--menuitem-icon');
        }
        return css;
    }

    /* Do not change below 不懂不要改下边的 */
    if (window.DownloadPlus) return;

    window.DownloadPlus = {
        PREF_FLASHGOT_PATH: "userChromeJS.downloadPlus.flashgotPath",
        PREF_DEFAULT_MANAGER: "userChromeJS.downloadPlus.flashgotDefaultManager",
        PREF_DOWNLOAD_MANAGERS: "userChromeJS.downloadPlus.flashgotDownloadManagers",
        SAVE_DIRS: [[Services.dirsvc.get('Desk', Ci.nsIFile).path, this_desktop], [
            Services.dirsvc.get('DfltDwnld', Ci.nsIFile).path, downloads_folder
        ]],
        get FLASHGOT_PATH () {
            delete this.FLASHGOT_PATH;
            const flashgotFile = Services.dirsvc.get("GreBinD", Ci.nsIFile);
            flashgotFile.append("upcheck.exe");
            return this.FLASHGOT_PATH = flashgotFile.exists() ? flashgotFile.path : false;
        },
        get DEFAULT_MANAGER () {
            return Services.prefs.getStringPref(this.PREF_DEFAULT_MANAGER, '');
        },
        set DEFAULT_MANAGER (value) {
            Services.prefs.setStringPref(this.PREF_DEFAULT_MANAGER, value);
        },
        init: async function () {
            const documentURI = location.href.replace(/\?.*$/, '');
            switch (documentURI) {
                case 'chrome://browser/content/browser.xhtml':
                    windowUtils.loadSheetUsingURIString("data:text/css;charset=utf-8," + encodeURIComponent(processCSS(globalCSS)), windowUtils.AUTHOR_SHEET);
                    await this.initChrome();
                    break;
                case 'about:downloads':
                case 'chrome://browser/content/places/places.xhtml':
                    windowUtils.loadSheetUsingURIString("data:text/css;charset=utf-8," + encodeURIComponent(processCSS(placesCSS)), windowUtils.AUTHOR_SHEET);
                    break;
                case 'chrome://mozapps/content/downloads/unknownContentType.xhtml':
                    windowUtils.loadSheetUsingURIString("data:text/css;charset=utf-8," + encodeURIComponent(processCSS(unknownContentCSS)), windowUtils.AGENT_SHEET);
                    await this.initDownloadPopup();
                    break;
            }
        },
        initChrome: async function () {
            // 保存按钮无需等待即可点击
            Services.prefs.setIntPref('security.dialog_enable_delay', 0);

            let sb = window.userChrome_js?.sb;
            if (!sb) {
                sb = Cu.Sandbox(window, {
                    sandboxPrototype: window,
                    sameZoneAs: window,
                });

                /* toSource() is not available in sandbox */
                Cu.evalInSandbox(`
                    Function.prototype.toSource = window.Function.prototype.toSource;
                    Object.defineProperty(Function.prototype, "toSource", {enumerable : false})
                    Object.prototype.toSource = window.Object.prototype.toSource;
                    Object.defineProperty(Object.prototype, "toSource", {enumerable : false})
                    Array.prototype.toSource = window.Array.prototype.toSource;
                    Object.defineProperty(Array.prototype, "toSource", {enumerable : false})
                `, sb);
                window.addEventListener("unload", () => {
                    setTimeout(() => {
                        Cu.nukeSandbox(sb);
                    }, 0);
                }, { once: true });
            }
            this.sb = sb;
            if (isTrue('userChromeJS.downloadPlus.enableSaveAndOpen')) {
                this.URLS_FOR_OPEN = [];
                const saveAndOpenView = {
                    onDownloadChanged: function (dl) {
                        if (dl.progress != 100) return;
                        if (window.DownloadPlus.URLS_FOR_OPEN.indexOf(dl.source.url) > -1) {
                            let target = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
                            target.initWithPath(dl.target.path);
                            target.launch();
                            window.DownloadPlus.URLS_FOR_OPEN[window.DownloadPlus.URLS_FOR_OPEN.indexOf(dl.source.url)] = "";
                        }
                    },
                    onDownloadAdded: function (dl) { },
                    onDownloadRemoved: function (dl) { },
                }
                const dlist = await Downloads.getList(Downloads.ALL);
                await dlist.addView(saveAndOpenView);
                window.addEventListener("beforeunload", () => {
                    if (typeof dlist.then == "function") {
                        dlist.then(list => {
                            list.removeView(saveAndOpenView).then(null, Cu.reportError);
                        });
                    }
                });
            }
            if (isTrue('userChromeJS.downloadPlus.showAllDrives')) {
                getAllDrives().forEach(drive => {
                    this.SAVE_DIRS.push([drive, l10n_format(disk_x, drive.replace(':\\', ""))])
                });
            }
            if (this.FLASHGOT_PATH) {
                this.reloadSupportedManagers();
                const pbtn = {
                    id: 'DownloadPlus-Btn',
                    removable: true,
                    defaultArea: CustomizableUI.AREA_NAVBAR,
                    type: "custom",
                    onBuild: doc => {
                        const btn = createEl(doc, 'toolbarbutton', {
                            id: 'DownloadPlus-Btn',
                            downloadplusbtn,
                            tooltiptext: download_enhance_click,
                            type: 'menu',
                            class: 'toolbarbutton-1 chromeclass-toolbar-additional FlashGot-icon',
                        });
                        btn.appendChild(this.populateMenu(doc, {
                            id: 'DownloadPlus-Btn-Popup',
                        }));
                        btn.addEventListener('mouseover', this, false);
                        return btn;
                    }
                };
                setTimeout(this.createToolbarBtn, 2000, pbtn);
            }
            if (Number(upcheck.readini_portable("General", "DownloadTaskOver")) > 0) {
                this.downloadIntegration();
            }
        },
        createToolbarBtn: async function(pbtn) {
            try {
                CustomizableUI.createWidget(pbtn);
            } catch (e) { }
        },
        downloadIntegration: function() {
            const alwaysOp = isTrue("browser.download.alwaysOpenPanel", false);
            const downloadlisten = {
                _list: null,
                init: function sampleinit() {
                    // 监视下载
                    if (!this._list) {
                        DownloadHistory.getList(Downloads.ALL).then(list => {
                            this._list = list;
                            return this._list.addView(this);
                        }).then(null, Cu.reportError);
                    }
                },

                onDownloadAdded: (aDownload) => {
                    // 开始下载
                    if (!exDomain(aDownload.source.url) && !isTrue("userChromeJS.downloadPlus.shown", false)) {
                        if (alwaysOp) {
                            // 先取消工具栏下载弹出面板, 下载后恢复
                            setBool("browser.download.alwaysOpenPanel", false);
                        }
                        // 取消本次下载以及删除历史记录
                        console.log("we delete [%s]", aDownload.source.url);
                        DownloadsCommon.deleteDownloadFiles(aDownload, 2);
                    }
                },
            
                onDownloadChanged: (aDownload) => {
                    // 重置userChromeJS.downloadPlus.shown, 启用拦截
                    if (isTrue("userChromeJS.downloadPlus.shown", false) && aDownload.currentBytes > 0) {
                        Services.prefs.clearUserPref("userChromeJS.downloadPlus.shown");
                    }
                    // 拦截了下载, 调用下载器
                    if (aDownload.error) {
                        // call upcheck;
                        const id = managerId(this.DEFAULT_MANAGER);
                        const referer = aDownload.source.referrerInfo ? aDownload.source.referrerInfo : null;
                        if (upcheck.download_caller(id, aDownload.source.url, referer, aDownload.target.path, null) == 0) {
                            // 注入页面, 添加下载提示
                            messageTip();
                        }
                        if (alwaysOp) {
                            Services.prefs.clearUserPref("browser.download.alwaysOpenPanel");
                        }
                    }
                }
            }
            downloadlisten.init();
        },
        initDownloadPopup: async function () {
            const dialogFrame = dialog.dialogElement('unknownContentType');
            // 原有按钮增加 accesskey
            dialogFrame.getButton('accept').setAttribute('accesskey', 'c');
            dialogFrame.getButton('cancel').setAttribute('accesskey', 'x');
            if (true) {
                let locationHbox = createEl(document, 'hbox', {
                    id: 'locationHbox',
                    flex: 1,
                    align: 'center',
                });
                let location = $('#location');
                location.hidden = true;
                location.after(locationHbox);
                let locationText = locationHbox.appendChild(createEl(document, "html:input", {
                    id: "locationText",
                    value: dialog.mLauncher.suggestedFileName,
                    flex: 1
                }));

                // 输入不能用于文件名的字符输入框变红
                locationText.addEventListener('input', function (e) {
                    const currentText = this.value;
                    if (currentText.match(invalidChars)) {
                        this.classList.add('invalid');
                    } else {
                        this.classList.remove('invalid');
                    }
                });
            }
            let h = createEl(document, 'hbox', { align: 'center' });
            $("#source").parentNode.after(h);
            // 复制链接
            if (isTrue('userChromeJS.downloadPlus.enableDoubleClickToCopyLink')) {
                let label = h.appendChild(createEl(document, 'label', {
                    innerHTML: complete_link,
                    style: 'margin-top: 1px'
                }));
                let description = h.appendChild(createEl(document, 'description', {
                    id: 'completeLinkDescription',
                    class: 'plain',
                    flex: 1,
                    crop: 'center',
                    value: dialog.mLauncher.source.spec,
                    tooltiptext: dobule_click_to_copy,
                }));
                [label, description].forEach(el => el.addEventListener("dblclick", () => {
                    copyText(dialog.mLauncher.source.spec);
                }));
            }
            if (isTrue('userChromeJS.downloadPlus.enableCopyLinkButton')) {
                h.appendChild(createEl(document, 'button', {
                    id: 'copy-link-btn',
                    label: copy_link,
                    size: 'small',
                    onclick: function () {
                        copyText(dialog.mLauncher.source.spec);
                        this.setAttribute("label", be_copied);
                        this.parentNode.classList.add("copied");
                        setTimeout(function () {
                            this.setAttribute("label", copy_link);
                            this.parentNode.classList.remove("copied");
                        }.bind(this), 1000);
                    }
                }));
            }
            // 双击保存
            if (isTrue('userChromeJS.downloadPlus.enableDoubleClickToSave')) {

                $('#save').addEventListener('dblclick', (event) => {
                    const { dialog } = event.target.ownerGlobal;
                    dialog.dialogElement('unknownContentType').getButton("accept").click();
                });
            }
            // 调用 Upcheck
            if (true) {
                const bw = Services.wm.getMostRecentWindow("navigator:browser");
                const { DownloadPlus: fdp } = bw;
                const download_managers = getManagers();
                if (fdp.FLASHGOT_PATH, download_managers.length) {
                    const createElem = (tag, attrs, children = []) => {
                        let elem = createEl(document, tag, attrs);
                        children.forEach(child => elem.appendChild(child));
                        return elem;
                    };
                    const triggerDownload = _ => {
                        const { mLauncher, mContext } = dialog;
                        let { source } = mLauncher;
                        if (source.schemeIs('blob')) {
                            source = Services.io.newURI(source.spec.slice(5));
                        }
                        let mSourceContext = mContext.BrowsingContext.get(mLauncher.browsingContextId);
                        fdp.downloadByManager($('#flashgotHandler').getAttribute('manager'), source.spec, {
                            fileName: $("#locationText")?.value?.replace(invalidChars, '_') || dialog.mLauncher.suggestedFileName,
                            mLauncher,
                            mSourceContext: mSourceContext.parent ? mSourceContext.parent : mSourceContext
                        })
                        close();
                    };
                    // 创建 Upcheck 选项
                    let flashgotHbox = createElem('hbox', { id: 'flashgotBox' }, [
                        createElem('radio', {
                            id: 'flashgotRadio',
                            label: download_through_upcheck,
                            accesskey: 'F',
                            ondblclick: () => {
                                triggerDownload();
                            }
                        }),
                        createElem('deck', { id: 'flashgotDeck', flex: 1 }, [
                            createElem('hbox', { flex: 1, align: 'center' }, [
                                createElem('menulist', {
                                    id: 'flashgotHandler',
                                    label: fdp.DEFAULT_MANAGER.length === 0 ? default_download_auto : l10n_format(default_download_manager, fdp.DEFAULT_MANAGER),
                                    manager: fdp.DEFAULT_MANAGER,
                                    flex: 1,
                                    native: true }, [(() => {
                                        let menupopup = createEl(document, 'menupopup', {
                                            id: 'DownloadPlus-Flashgot-Handler-Popup',
                                        });
                                        menupopup.addEventListener('popupshowing', this, false);
                                        return menupopup;
                                    })()
                                ]),
                                // 隐藏此按钮, 只需要按钮id
                                createElem('toolbarbutton', {
                                    id: 'Flashgot-Download-By-Default-Manager',
                                    style: "display:none",
                                    oncommand: () => {
                                        $('#flashgotRadio').click();
                                        triggerDownload();
                                    }
                                })
                            ])
                        ])
                    ]);
                    $('#mode').appendChild(flashgotHbox);
                    setTimeout(() => {
                        if (isTrue('userChromeJS.downloadPlus.selected', false)) {
                            dialog.dialogElement("mode").selectedItem = dialog.dialogElement("flashgotRadio");
                        }
                        dialogFrame.getButton("accept").focus();
                    }, 100);
                }
            }
            // 保存并打开
            if (isTrue('userChromeJS.downloadPlus.enableSaveAndOpen')) {
                let saveAndOpen = createEl(document, 'button', {
                    id: 'save-and-open',
                    label: save_and_open,
                    accesskey: 'P',
                    size: 'small',
                    part: 'dialog-button'
                });
                saveAndOpen.addEventListener('click', () => {
                    Services.wm.getMostRecentWindow("navigator:browser").DownloadPlus.URLS_FOR_OPEN.push(dialog.mLauncher.source.asciiSpec);
                    dialog.dialogElement('save').click();
                    dialogFrame.getButton("accept").disabled = 0;
                    dialogFrame.getButton("accept").click();
                });
                dialogFrame.getButton('extra2').before(saveAndOpen);
            }
            // 另存为
            if (isTrue('userChromeJS.downloadPlus.enableSaveAs')) {
                let saveAs = createEl(document, 'button', {
                    id: 'save-as',
                    label: save_as,
                    accesskey: 'E',
                    oncommand: function () {
                        fileSaveAs();
                    }
                });
                dialogFrame.getButton('extra2').before(saveAs);
            }
            // 快速保存
            if (isTrue('userChromeJS.downloadPlus.enableSaveTo')) {
                let saveTo = createEl(document, 'button', {
                    id: 'save-to',
                    part: 'dialog-button',
                    size: 'small',
                    label: save_to,
                    type: 'menu',
                    accesskey: 'T'
                });
                let saveToMenu = createEl(document, 'menupopup');
                saveToMenu.appendChild(createEl(document, "html:link", {
                    rel: "stylesheet",
                    href: "chrome://global/skin/global.css"
                }));
                saveToMenu.appendChild(createEl(document, "html:link", {
                    rel: "stylesheet",
                    href: "chrome://global/content/elements/menupopup.css"
                }));
                saveTo.appendChild(saveToMenu);
                Services.wm.getMostRecentWindow("navigator:browser").DownloadPlus.SAVE_DIRS.forEach(item => {
                    let [name, dir] = [item[1], item[0]];
                    saveToMenu.appendChild(createEl(document, "menuitem", {
                        label: name || (dir.match(/[^\\/]+$/) || [dir])[0],
                        dir: dir,
                        image: "moz-icon:file:///" + dir + "\\",
                        class: "menuitem-iconic",
                        onclick: function () {
                            let dir = this.getAttribute('dir');
                            let file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
                            let path = dir.replace(/^\./, Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties).get("ProfD", Ci.nsIFile).path);
                            path = path.endsWith("\\") ? path : path + "\\";
                            setBool("userChromeJS.downloadPlus.shown");
                            file.initWithPath(path + ($("#locationText")?.value?.replace(invalidChars, '_') || dialog.mLauncher.suggestedFileName));
                            if (dialog.mLauncher.MIMEInfo) {
                                dialog.mLauncher.MIMEInfo.preferredAction = Ci.nsIMIMEInfo.saveToDisk;
                                dialog.mLauncher.MIMEInfo.alwaysAskBeforeHandling = false;
                            }
                            dialog.mLauncher.saveDestinationAvailable(file);
                            dialog.onCancel = function () { };
                            close();
                        }
                    }));
                })
                dialogFrame.getButton('cancel').before(saveTo);
            }
            dialog.onOK = (() => {
                var cached_function = dialog.onOK;
                return async function (...args) {
                    const upk = $('#flashgotRadio')?.selected;
                    if (upk) {
                        setBool("userChromeJS.downloadPlus.selected");
                    }
                    else
                    {
                        setBool("userChromeJS.downloadPlus.shown");
                        Services.prefs.clearUserPref("userChromeJS.downloadPlus.selected");
                    }
                    if (upk) {
                        return $('#Flashgot-Download-By-Default-Manager').click();
                    }
                    else if ($('#locationText')?.value && $('#locationText')?.value != dialog.mLauncher.suggestedFileName) {
                        if (isTrue('browser.download.useDownloadDir')) {
                            dialog.onCancel = function () { };
                            let file = await IOUtils.getFile(await Downloads.getPreferredDownloadsDirectory(), $('#locationText').value);
                            return dialog.mLauncher.saveDestinationAvailable(file);
                        } else {
                            fileSaveAs();
                        }
                    }
                    else {
                        return cached_function.apply(this, ...args);
                    }
                };
            })();
            setTimeout(() => {
                // 强制显示打开/保存/Upcheck选项
                document.getElementById("normalBox").removeAttribute("collapsed");
                window.sizeToContent();
            }, 100);
        },
        handleEvent: async function (event) {
            const { button, type, target } = event;
            if (type === 'popupshowing') {
                if (target.id === "DownloadPlus-Btn-Popup") {
                    this.populateDynamicItems(target);
                } else if (target.id === "DownloadPlus-Flashgot-Handler-Popup") {
                    let dropdown = event.target;
                    const download_managers = getManagers();
                    dropdown.querySelectorAll('menuitem[manager]').forEach(e => e.remove());
                    download_managers.forEach(manager => {
                        const menuitemManager = createEl(dropdown.ownerDocument, 'menuitem', {
                            label: this.DEFAULT_MANAGER === manager ? l10n_format(default_download_manager, manager) : manager,
                            manager,
                            default: this.DEFAULT_MANAGER === manager
                        });
                        menuitemManager.addEventListener('command', (event) => {
                            const { target } = event;
                            const { ownerDocument: aDoc } = target;
                            const handler = aDoc.querySelector("#flashgotHandler");
                            target.parentNode.querySelectorAll("menuitem").forEach(el => el.removeAttribute("selected"));
                            handler.setAttribute("label",
                                target.getAttribute("default") === "true" ? l10n_format(default_download_manager, target.getAttribute("manager")) : target.getAttribute("manager"));
                            handler.setAttribute("manager", target.getAttribute("manager"));
                            target.setAttribute("selected", true);
                            aDoc.querySelector("#flashgotRadio").click();
                        })
                        dropdown.appendChild(menuitemManager);
                    })
                }
            } else if (type === "mouseover") {
                const btn = target.ownerDocument.querySelector('#DownloadPlus-Btn');
                if (!btn) return;
                const mp = btn.querySelector("#DownloadPlus-Btn-Popup");
                if (!mp) return;
                // 获取按钮的位置信息
                const rect = btn.getBoundingClientRect();
                // 获取窗口的宽度和高度
                const windowWidth = target.ownerGlobal.innerWidth;
                const windowHeight = target.ownerGlobal.innerHeight;

                const x = rect.left + rect.width / 2;  // 按钮的水平中心点
                const y = rect.top + rect.height / 2;  // 按钮的垂直中心点

                if (x < windowWidth / 2 && y < windowHeight / 2) {
                    mp.removeAttribute("position");
                } else if (x >= windowWidth / 2 && y < windowHeight / 2) {
                    mp.setAttribute("position", "after_end");
                } else if (x >= windowWidth / 2 && y >= windowHeight / 2) {
                    mp.setAttribute("position", "before_end");
                } else {
                    mp.setAttribute("position", "before_start");
                }
            }
        },
        populateMenu: function (doc, menuObj) {
            const popup = createEl(doc, 'menupopup', menuObj);
            if (menuObj.id === 'DownloadPlus-Btn-Popup') {
                popup.appendChild(createEl(doc, 'menuitem', {
                    label: reload_download_managers,
                    id: 'FlashGot-reload',
                    class: 'FlashGot-reload menuitem-iconic',
                    oncommand: () => {
                        this.reloadSupportedManagers(true, () => {
                            $('#DownloadPlus-Btn-Popup')?.removeAttribute("initialized");
                        });
                    }
                }));
            }
            popup.appendChild(createEl(doc, 'menuseparator', {
            }));
            popup.appendChild(createEl(doc, 'menuseparator', {
                id: 'FlashGot-DownloadManagers-Separator'
            }));
            popup.appendChild(createEl(doc, 'menuitem', {
                label: aria2_webui,
                id: 'aria2-webui',
                oncommand: function () {
                    openTrustedLinkIn("http://127.0.0.1:9990", "tab");
                }
            }));
            popup.appendChild(createEl(doc, 'menuseparator', {
                id: 'FlashGot-DownloadManagers-Separator'
            }));
            popup.appendChild(createEl(doc, 'menuitem', {
                label: about_download_plus,
                id: 'FlashGot-about',
                oncommand: function () {
                    openTrustedLinkIn("https://github.com/benzBrake/Firefox-downloadPlus.uc.js", "tab");
                }
            }));
            popup.addEventListener('popupshowing', this, false);
            return popup;
        },
        populateDynamicItems: function (popup) {
            const download_managers = getManagers();
            if (popup.hasAttribute("initialized")) {
                return;
            }
            if (!download_managers.length) {
                return;
            }
            popup.setAttribute("initialized", true);
            popup.querySelectorAll('menuitem[dynamic]').forEach(item => item.remove());
            const sep = popup.querySelector("#FlashGot-DownloadManagers-Separator")

            for (let name of download_managers) {
                let obj = {
                    label: name,
                    managerId: name.trim().replace(/\s+/g, '-'),
                    dynamic: true,
                };
                if (popup.id === "DownloadPlus-Btn-Popup") {
                    obj.type = 'radio';
                    obj.oncommand = () => {
                        this.DEFAULT_MANAGER = name;
                    }
                    obj.checked = this.isManagerEnabled(name);
                }
                let item = createEl(popup.ownerDocument, 'menuitem', obj);
                popup.insertBefore(item, sep);
            }
            if (!popup.querySelector("menuitem[dynamic]")) popup.removeAttribute("initialized");
        },
        isManagerEnabled: function (name) {
            return this.DEFAULT_MANAGER === name;
        },
        reloadTools: function (value, callback = null) {
            let manager = [];
            if (value & 0x8) {
                manager.push("Aria2 Rpc");
            }
            if (value & 0x4) {
                manager.push("Aria2 Cmd");
            }
            if (value & 0x2) {
                manager.push("Thunder");
            }
            if (value & 0x1) {
                manager.push("Upcheck");
            }
            Services.prefs.setStringPref("userChromeJS.downloadPlus.flashgotDownloadManagers", manager.join(","));
            if (typeof callback === "function") {
                callback(this);
            }
        },
        reloadSupportedManagers: async function (force = false, callback) {
            const download_managers = getManagers();
            if (!download_managers.length || force) {
                upcheck.runSelf(["-collect", this.reloadTools, callback]);
            }
            else if (typeof callback === "function") {
                callback(this);
            }
        },
        downloadByManager: async function (manager, url, options = {}) {
            if (!manager) {
                manager = this.DEFAULT_MANAGER;
            }
            if (!url) {
                url = gBrowser.selectedBrowser.currentURI.spec;
            }
            if (url) {
                let referer = '', filename = options.fileName;
                const id = managerId(manager);
                if (options) {
                    if (options.mBrowser) {
                        const { mContentData } = options;
                        referer = mContentData.referrerInfo.originalReferrer.spec
                    }
                    else if (options.mLauncher) {
                        const { mSourceContext } = options;
                        referer = mSourceContext.currentURI.spec;
                    }
                }
                // call upcheck;
                upcheck.download_caller(id, url, referer, filename, null);
            }
        }
    }

    function fileSaveAs() {
        const mainwin = Services.wm.getMostRecentWindow("navigator:browser");
        // 感谢 ycls006 / alice0775
        Cu.evalInSandbox("(" + mainwin.internalSave.toString().replace("let ", "").replace("var fpParams", "fileInfo.fileExt=null;fileInfo.fileName=aDefaultFileName;var fpParams") + ")", mainwin.DownloadPlus.sb)(dialog.mLauncher.source.asciiSpec, null, null, ($("#locationText")?.value?.replace(invalidChars, '_') || dialog.mLauncher.suggestedFileName), null, null, false, null, null, null, null, null, false, null, mainwin.PrivateBrowsingUtils.isBrowserPrivate(mainwin.gBrowser.selectedBrowser), Services.scriptSecurityManager.getSystemPrincipal());
        close();
    }

    function messageTip() {
        // 注入页面, 添加下载提示
        if (!document.getElementById('iceweasel-message-box')) {
            document.body.appendChild(createEl(document, "html:div", {
                id: "iceweasel-message-box",
                innerHTML: added_download,
                // 使用较高的Z轴, 1000, 确保fixed生效
                style: "color:white; background-color:#f44336; bottom:20px; right:30px; position:fixed; z-index:1000; border-radius:5px; box-shadow:0px 8px 16px 0px rgba(0,0,0,0.2); padding:10px; font-size:18px;",
            }));
        }
        const messageBox = document.getElementById('iceweasel-message-box');
        messageBox.style.display = 'flex';
        setTimeout(() => {
          messageBox.style.display = 'none';
        }, 2000);
    }

    function exDomain(url) {
        let ex = false;
        if (url && url.length > 0) {
            // 某些网站可能不适用于下载器, 只能用浏览器下载
            // 在这里排除它
            let Domain = [
                  'blob:',
                  'moz-extension://',
                  'subhdtw.com',
                  'subhd.tv',
                  '/\.xpi$/i',
                  '/xpinstall$/i'
            ];
            for(let item of Domain) {
                if (url.search(item) >= 0) {
                    ex = true;
                    break;
                }
            }
        }
        return ex;
    }

    function getManagers () {
        let managers = [];
        const pref = Services.prefs.getStringPref("userChromeJS.downloadPlus.flashgotDownloadManagers", "");
        if (pref && pref.length > 0) {
            managers = pref.split(",");
        }
        return managers;
    }

    function managerId (manager) {
        let id = 0;
        if (manager && manager.length > 0) {
            if (manager === "Aria2 Rpc") {
                id = 1;
            }
            else if (manager === "Aria2 Cmd") {
                id = 2;
            }
            else if (manager === "Thunder") {
                id = 3;
            }
            else if (manager === "Upcheck") {
                id = 4;
            }
        }
        return id;
    }

    function isTrue (pref, defaultValue = true) {
        return Services.prefs.getBoolPref(pref, defaultValue) === true;
    }

    function setBool (pref, defaultValue = true) {
        if (defaultValue) {
          if (!isTrue(pref, false)) {
              Services.prefs.setBoolPref(pref, true);
          }
        }
        else if (isTrue(pref, false)) {
            Services.prefs.setBoolPref(pref, false);
        }
    }

    function l10n_format(...args) {
        if (!args.length) {
            throw new Error("format: no arguments");
        }

        const formatString = args[0];
        const values = args.slice(1);
        let valueIndex = 0;
        let result = "";

        if (typeof formatString !== 'string') {
            throw new Error("format: first argument must be a string");
        }

        if (!values.length) {
            return formatString.charAt(0).toUpperCase() + formatString.slice(1);
        }

        for (let i = 0; i < formatString.length; i++) {
            if (formatString[i] === '%') {
                i++; // Move to the next character (the format specifier)

                if (i >= formatString.length) {
                    // Incomplete format specifier at the end, treat as literal '%'
                    result += '%';
                    break;
                }

                switch (formatString[i]) {
                    case 's': // String
                        if (valueIndex < values.length) {
                            result += String(values[valueIndex]);
                            valueIndex++;
                        } else {
                            result += '%s'; // Not enough arguments
                        }
                        break;
                    case 'n': // Number
                        if (valueIndex < values.length) {
                            const num = Number(values[valueIndex]);
                            if (isNaN(num)) {
                                result += 'NaN';
                            } else {
                                result += num.toString();
                            }
                            valueIndex++;
                        } else {
                            result += '%n'; // Not enough arguments
                        }
                        break;

                    case '%': // Literal '%'
                        result += '%';
                        break;
                    default:
                        // Unknown format specifier - treat as literal characters
                        result += '%' + formatString[i];
                }
            } else {
                result += formatString[i];
            }
        }

        while (valueIndex < values.length) {
            result += " " + String(values[valueIndex]);
            valueIndex++;
        }

        return result;
    }

    /**
     * 获取所有盘符，用到 dll 调用，只能在 windows 下使用
     * 
     * @system windows
     * @returns {array} 所有盘符数组
     */
    function getAllDrives () {
        let lib = ctypes.open("kernel32.dll");
        let GetLogicalDriveStringsW = lib.declare('GetLogicalDriveStringsW', ctypes.winapi_abi, ctypes.unsigned_long, ctypes.uint32_t, ctypes.char16_t.ptr);
        let buffer = new (ctypes.ArrayType(ctypes.char16_t, 1024))();
        let rv = GetLogicalDriveStringsW(buffer.length, buffer);
        let resultLen = parseInt(rv.toString() || "0");
        let arr = [];
        if (!resultLen) {
            lib.close();
            return arr;
        }
        for (let i = 0; i < resultLen; i++) {
            arr[i] = buffer.addressOfElement(i).contents;
        }
        arr = arr.join('').split('\0').filter(el => el.length);
        lib.close();
        return arr;
    }

    /**
     * 选择 HTML 元素
     * 
     * @param {string} sel 选择表达式
     * @returns 
     */
    function $ (sel) {
        return document.querySelector(sel);
    }

    /**
     * 创建 DOM 元素
     * 
     * @param {Document} doc 
     * @param {string} type 
     * @param {Object} attrs 
     * @returns 
     */
    function createEl (doc, type, attrs = {}) {
        let el = type.startsWith('html:') ? doc.createElementNS('http://www.w3.org/1999/xhtml', type) : doc.createXULElement(type);
        for (let key of Object.keys(attrs)) {
            if (key === 'innerHTML') {
                el.innerHTML = attrs[key];
            } else if (key.startsWith('on')) {
                el.addEventListener(key.slice(2).toLocaleLowerCase(), attrs[key]);
            } else {
                el.setAttribute(key, attrs[key]);
            }
        }
        return el;
    }

    /**
     * 复制文本到剪贴板
     * 
     * @param {string} aText 需要复制的文本
     */
    function copyText (aText) {
        Cc["@mozilla.org/widget/clipboardhelper;1"].getService(Ci.nsIClipboardHelper).copyString(aText);
    }

    await window.DownloadPlus.init();
})(`
.FlashGot-icon {
    list-style-image: url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAABd0lEQVQ4T5WTv0/CQBzFXy22Axh+NHXqYJjAYggd2JTYNrK5OTg5GTf/Dv0jHEjUzdnEUHbD1KQaEwYTnAwlhiiIxub0jvCjFCjeeN/3Pn33eschZFWrVZJOpxGPxyFJEjctD2xMCqjZMIzRluu6kGXZ5wkAqIk6kskkNE3zfZAC6JqE+ADUXCqVwPM8E3JcMCAhBO12ewQZKai5UCgglUotbGUIGCZhgOmzhhXreR4sy0K5XB5kpABd18N8vnmtVoNpmmNAPp//F8C27TGgXq+z5judzlKQSCQCVVVZkb6aHxyHCKKIt/MDH+jn2cF334N7coGsVmQzNZdj3sB/sg6zRFeaTETWFHitBj5egNezR2QymfCb2DJBEtkV8OuDEA2bYOOqD1EUZ97awGav1yPvR1HIO38Jvjh8OgTN03tsasXlALdGjOzud7EaA+6uo9iqPEFRlLlvJjCggL3jLtwbIHE5P/qw5Zkl0uF2xYYgCAtfK9X9AmZ+hRG+dHY+AAAAAElFTkSuQmCC');
}
.FlashGot-reload {
    list-style-image: url("chrome://global/skin/icons/reload.svg");
}

menuseparator:not([hidden=true])+#FlashGot-DownloadManagers-Separator,
#context-media-eme-learnmore:has(~ #FlashGot-ContextMenu[hide-eme-sep=true]) {
    display: none !important;
}
`, `
#downloadsContextMenu:not([needsgutter]) > .downloadPlus-menuitem > .menu-iconic-left {
    visibility: collapse;
}
`, `
#contentTypeImage {
    height: 24px !important;
    width: 24px !important;
    margin-top: 3px !important;
}
#location {
    padding: 3px 0;
}
#locationText {
    flex: 1;
    appearance: none;
    padding-block: 2px !important;
    margin: 0;
    min-height: calc(var(--button-min-height-small, 28px) - 4px - 2px) !important;
    max-height: calc(var(--button-min-height-small, 28px) - 4px - 2px) !important;
}
#locationText.invalid {
    outline: 2px solid red !important;
    background-color: #ffc0c0 !important;
}
#locationHbox {
    display: flex;
    margin-right: 6px;
}
#locationHbox[hidden="true"] {
    visibility: collapse;
}
#basicBox {
    display: none;
}
#completeLinkDescription {
    max-width: 340px;
    cursor:pointer;
}
hbox.copied > #completeLinkDescription {
    text-decoration: underline;
}
#openHandler,
#flashgotHandler,
.dialog-button-box > .dialog-button {
    min-height: var(--button-min-height-small, 28px) !important;
    max-height: var(--button-min-height-small, 28px) !important;
}
.button-menu-dropmarker {
    appearance: none;
    content: url("chrome://global/skin/icons/arrow-down-12.svg");
    -moz-context-properties: fill;
    fill: currentColor;
}
`)
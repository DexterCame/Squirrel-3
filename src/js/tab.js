/**
 * @file SQ.Tab 选项卡插件
 * @version 1.0.0
 */

/**
 * @changelog
 * 1.0.0  * 重写插件，调用方式改为 $. 链式调用。
 * 0.7.5  * 修改类名，新增 beforeLoad 、loaded 回调函数的传参。
 * 0.7.4  * 解决 localStorage 问题，API 兼容 ["","test.json",""] 这种写法；
 *        * CSS_LOADING_TIP 兼容 ".demo" 和 "demo" 写法。
 * 0.7.3  * 修复 reload 按钮多次绑定问题。
 * 0.7.2  * 修复初始化时，me.$loadingTip 无法找到的问题。
 * 0.7.1  * 修复 jshint 问题。
 * 0.7.0  + 添加对 localStorage 支持，通过将 LOCAL_DATA 设置为 true 开启，通过 NUM_EXPIRES 来设置过期时间（单位：分钟）。
 * 0.6.1  * 屏蔽 click 默认动作，新增自定义 CSS_HIGHLIGHT 属性。
 * 0.6.0  * 重写 Tabs 插件，使 Tabs 插件能够在同一页面多次实例化。
 * 0.5.6  * 修改插件名称为 Tabs。
 * 0.5.1  * 完成选项卡基本功能。
 * 0.0.1  + 新建。
 */
/*global
 $: false,
 SQ: false,
 console: false
 */
;(function ($) {
    "use strict";
    /**
     * @name Tab
     * @classdesc 选项卡插件
     * @constructor
     * @param {object} config                                           插件配置（下面的参数为配置项，配置会写入属性）
     * @param {string} config.EVE_EVENT_TYPE                            触发事件，click 或 mouseover
     * @param {string} config.DOM_TABS                                  标签 Dom 元素
     * @param {string} config.DOM_PANELS                                面板 Dom 元素
     * @param {string} config.API                                       API 接口① 字符串形式
     * @param {array}  config.API                                       API 接口② 数组形式，数组中各项对应各个选项卡
     * @param {string} config.CSS_HIGHLIGHT                             自定义高亮样式名称，默认为 .active
     * @param {string} config.CSS_LOADING_TIP                           loading 提示样式
     * @param {string} config.TXT_LOADING_TIP                           loading 提示文字
     * @param {number} config.NUM_ACTIVE                                初始高亮选项卡序号，0 - n
     * @param {number} config.NUM_XHR_TIMEER                            XHR 超时时间
     * @param {boolean} config.CLEAR_PANEL                              切换选项卡时是否自动清理面板数据
     * @param {string} config.LOCAL_DATA                                XHR 数据 loaclstorage 开关，默认为 false
     * @param {number} config.NUM_EXPIRES                               XHR 数据 loaclstorage 过期时间（单位：分钟），默认为 15 分钟
     * @param {function} config.trigger($tabs,$panels,tabIndex)         触发选项卡切换回调函数
     * @param {function} config.show($tabs,$panels,tabIndex)            显示选项卡时回调函数
     * @param {function} config.beforeLoad($activePanels,tabIndex)      异步加载前回调函数，当设定了该回调函数时，必须返回
     *                                                                  true 才能继续执行，异步加载事件，可中断异步加载事件。
     *                                                                  参数：$activePanels 是当前激活的面板
     * @param {function} config.loaded(data,$activePanels,tabIndex)     异步加载成功回调函数，参数：data 是异步加载返回数据
     *                                                                  参数：$activePanels 是当前激活的面板
     * @example $(".J_tabs").tab({
    API: ["data/content1.json", "data/content2.json", ""],
    DOM_TABS: ".sq-nav-tabs>li",
    DOM_PANELS: ".sq-tab-content",
    CSS_LOADING_TIP: ".tab-loading-tip",
    show: function ($tabs, $panels, tabIndex) {

    },
    loaded: function (data, $activePanels) {

    }
});
     */
    var scope = "sq-tab";
    var defaults = {
        EVE_EVENT_TYPE: "click",
        CSS_HIGHLIGHT: ".active",
        CLEAR_PANEL : false,
        NUM_ACTIVE : 0,
        NUM_XHR_TIMEER : 5000,
        TXT_LOADING_TIP : "正在加载请稍后...",     // 正在加载提示
        LOCAL_DATA : false,
        NUM_EXPIRES : 15
    };

    function Tab ( element, options ) {
        this.element = element;
        this.settings = $.extend( {}, defaults, options );
        this._defaults = defaults;
        this.init();
    }

    Tab.prototype = {
        construtor: "Tab",
        needLoadContent : false,    // 选项卡内容是否需要异步加载
        init: function () {
            var me = this;
            
            if (me.settings.CSS_LOADING_TIP) {
                me.CSS_LOADING_TIP = me.settings.CSS_LOADING_TIP.indexOf(".") === 0 ? me.settings.CSS_LOADING_TIP.slice(1) : me.settings.CSS_LOADING_TIP;
            }
            me.CSS_HIGHLIGHT = me.settings.CSS_HIGHLIGHT.indexOf(".") === 0 ? me.settings.CSS_HIGHLIGHT.slice(1) : me.settings.CSS_HIGHLIGHT;

            me.$element = $(me.element);        // 目标元素
            me.tabsLen = me.$element.length;

            me.triggerFun = me.settings.trigger;
            me.showFun = me.settings.show;
            me.beforeLoadFun = me.settings.beforeLoad;
            me.loadFun = me.settings.loaded;

            me.$element.each(function () {
                var $tabMould = $(this);
                var $tabs = $tabMould.find(me.settings.DOM_TABS);
                var $panels = $tabMould.find(me.settings.DOM_PANELS);
                if (me._verify()) {
                    me._init($tabMould, $tabs, $panels);
                }
            });
        },
        _verify: function () {
            return true;
        },
        _init: function ($tabMould, $tabs, $panels) {
            var me = this;
            var i = 0;
            // 为选项卡添加序号
            $tabs.each(function () {
                $(this).attr("data-tabIndex", i);
                i++;
            });
            // 判断是否需要生成异步加载提示语
            if (me.settings.API && (SQ.isString(me.settings.API) || SQ.isArray(me.settings.API))) {
                me.$loadingTip = $("<div class='sq-tabs-loading-tip'></div>");
                if (me.CSS_LOADING_TIP) {
                    me.$loadingTip.addClass(me.CSS_LOADING_TIP);
                } else {
                    me.$loadingTip.css({
                        "height" : 60,
                        "text-align" : "center",
                        "line-height" : "60px"
                    });
                }
                me.$loadingTip.text(me.settings.TXT_LOADING_TIP);
                me.needLoadContent = true;
            }
            // 初始化高亮
            if (me.settings.NUM_ACTIVE !== undefined) {
                me.show($tabs, $panels, me.settings.NUM_ACTIVE);
            }
            // 绑定事件
            $tabs.on(me.settings.EVE_EVENT_TYPE + ".sq.tab", function (e) {
                var $tab = $(this);
                e.preventDefault();
                me._trigger($tabMould, $tabs, $panels, $tab);
            });
        },
        /**
         * 触发事件方法，在满足绑定事件条件时或满足指定触发条件的情况下调用触发方法，
         * 该方法用于集中处理触发事件，判定是否需要加载数据或者更新 UI 显示。
         * @param $tabMould
         * @param $tabs
         * @param $panels
         * @param $tab
         * @private
         */
        _trigger: function ($tabMould, $tabs, $panels, $tab) {
            var me = this;
            var tabIndex = $tab.attr("data-tabIndex");
            var isCurrentActive = $tab.hasClass(me.CSS_HIGHLIGHT);

            if (isCurrentActive) {
                return;
            }

            me.show($tabs, $panels, tabIndex);
            if (me.triggerFun) {
                me.triggerFun($tabs, $panels, tabIndex);
            }
        },
        _cleanPanel: function ($activePanels) {
            $activePanels.empty();
        },
        /**
         * 显示目标选项卡，可以在外部调用该方法
         * @param $tabs
         * @param $panels
         * @param tabIndex
         */
        show: function ($tabs, $panels, tabIndex) {
            var me = this;
            var $activeTab = $tabs.eq(tabIndex);
            var $activePanels = $panels.eq(tabIndex);

            $tabs.removeClass(me.CSS_HIGHLIGHT);
            $panels.removeClass(me.CSS_HIGHLIGHT);
            $activeTab.addClass(me.CSS_HIGHLIGHT);
            $activePanels.addClass(me.CSS_HIGHLIGHT);

            if (me.showFun) {
                me.showFun($tabs, $panels, tabIndex);
            }
            if (me.settings.API) {
                me._load($activePanels, tabIndex);
            }
        },
        _load: function ($activePanels, tabIndex) {
            var me = this;
            var api = me.settings.API;
            var $currentLoadTip = $activePanels.find(".sq-tabs-loading-tip");
            var hasLoadingTip = $currentLoadTip.length > 0 ? true : false;
            var hasLoaded = $activePanels.hasClass("hasLoaded");

            if (hasLoaded) {
                return;
            }
            // 如果设置了 beforeLoadFun 回调函数，则 beforeLoadFun 必须返回 true 才能继续向下执行，
            // 用于人为中断 _load 事件。
            if (me.beforeLoadFun) {
                if (!me.beforeLoadFun($activePanels, tabIndex)) {
                    return;
                }
            }
            // 是否清空面板
            if (me.settings.CLEAR_PANEL) {
                me._cleanPanel($activePanels);
            }
            // 是否启用本地缓存
            if (me.settings.LOCAL_DATA) {
                var localData = SQ.store.localStorage.get(api, me.settings.NUM_EXPIRES);
                localData = SQ.isString(localData) ? $.parseJSON(localData) : localData;
                if (localData) {
                    $activePanels.addClass("hasLoaded");
                    if (me.loadFun) {
                        me.loadFun(JSON.parse(localData), $activePanels, tabIndex);
                    }
                    return;
                }
            }
            // 开始 XHR 流程
            if (SQ.isArray(me.settings.API)) {
                api = me.settings.API[tabIndex];
            }
            if (!api || api.length === 0) {
                return;
            }
            if (me.xhr) {
                me.xhr.abort();
            }
            // 显示加载提示语
            if (hasLoadingTip) {
                $currentLoadTip.show();
            } else {
                $activePanels.append(me.$loadingTip);
                $currentLoadTip = $activePanels.find(".sq-tabs-loading-tip");
                $currentLoadTip.show();
            }
            me.xhr = $.ajax({
                type : "POST",
                url : api,
                dataType : "json",
                timeout : me.settings.NUM_XHR_TIMEER,
                success : function (data) {
                    $currentLoadTip.hide();
                    $activePanels.addClass("hasLoaded");    // 为已经加载过的面板添加 .hasLoaded 标记
                    if (me.settings.LOCAL_DATA) {
                        SQ.store.localStorage.set(api, data);
                    }
                    if (me.loadFun) {
                        me.loadFun(data, $activePanels, tabIndex);
                    }
                },
                error : function () {
                    me._showReloadTips($activePanels, tabIndex);
                }
            });
        },
        _showReloadTips: function ($activePanels, tabIndex) {
            var me = this;
            var $tip = $activePanels.find(".sq-tabs-loading-tip");
            $tip.show().empty();
            var reloadHTML = "<div class='reload'>" +
                "<p>抱歉，加载失败，请重试</p>" +
                "<div class='sq-btn f-grey J_reload'>重新加载</div>" +
                "</div>";
            $tip.append(reloadHTML);
            $activePanels.find(".J_reload").off("click").on("click", function () {
                me._load($activePanels, tabIndex);
            });
        }
    };

    $.fn.tab = function ( options ) {
        var isZepto = typeof Zepto !== "undefined" ? true : false;
        var isJQuery = typeof jQuery !== "undefined" ? true : false;
        var plugin;

        options = options || {};
        options.selector = this.selector;

        this.each(function() {
            if (isJQuery) {
                if ( !$.data( this, scope ) ) {
                    $.data( this, scope, new Tab( this, options ) );
                }
            } else if (isZepto) {
                if (!$(this).data(scope)) {
                    plugin = new Tab( this, options );
                    $(this).data(scope, "initialized");
                }
            }
        });
        // chain jQuery functions
        return this;
    };
})($);
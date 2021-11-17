/*!
 * template_js 2.1.0 (https://github.com/yanhaijing/template)
 * API https://github.com/yanhaijing/template/blob/master/doc/api.md
 * Copyright 2017-2019 yanhaijing. All Rights Reserved
 * Licensed under MIT (https://github.com/yanhaijing/template/blob/master/LICENSE)
 */

(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global.template = factory());
}(this, (function () { 'use strict';

  /*!
   * @jsmini/type 0.9.2 (https://github.com/jsmini/type)
   * API https://github.com/jsmini/type/blob/master/doc/api.md
   * Copyright 2017-2019 jsmini. All Rights Reserved
   * Licensed under MIT (https://github.com/jsmini/type/blob/master/LICENSE)
   */

  function _typeof(obj) {
    if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") {
      _typeof = function (obj) {
        return typeof obj;
      };
    } else {
      _typeof = function (obj) {
        return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
      };
    }

    return _typeof(obj);
  }

  var toString = Object.prototype.toString;
  function type(x) {
    var strict = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
    strict = !!strict; // fix typeof null = object

    if (x === null) {
      return 'null';
    }

    var t = _typeof(x); // 严格模式 区分NaN和number


    if (strict && t === 'number' && isNaN(x)) {
      return 'nan';
    } // number string boolean undefined symbol


    if (t !== 'object') {
      return t;
    }

    var cls;
    var clsLow;

    try {
      cls = toString.call(x).slice(8, -1);
      clsLow = cls.toLowerCase();
    } catch (e) {
      // ie下的 activex对象
      return 'object';
    }

    if (clsLow !== 'object') {
      if (strict) {
        // 区分NaN和new Number
        if (clsLow === 'number' && isNaN(x)) {
          return 'NaN';
        } // 区分 String() 和 new String()


        if (clsLow === 'number' || clsLow === 'boolean' || clsLow === 'string') {
          return cls;
        }
      }

      return clsLow;
    }

    if (x.constructor == Object) {
      return clsLow;
    } // Object.create(null)


    try {
      // __proto__ 部分早期firefox浏览器
      if (Object.getPrototypeOf(x) === null || x.__proto__ === null) {
        return 'object';
      }
    } catch (e) {} // ie下无Object.getPrototypeOf会报错
    // function A() {}; new A


    try {
      var cname = x.constructor.name;

      if (typeof cname === 'string') {
        return cname;
      }
    } catch (e) {} // 无constructor
    // function A() {}; A.prototype.constructor = null; new A


    return 'unknown';
  }

  /*!
   * @jsmini/is 0.8.5 (https://github.com/jsmini/is)
   * API https://github.com/jsmini/is/blob/master/doc/api.md
   * Copyright 2017-2019 jsmini. All Rights Reserved
   * Licensed under MIT (https://github.com/jsmini/is/blob/master/LICENSE)
   */
  function isObject(x) {
    return type(x) === 'object';
  }
  function isFunction(x) {
    return type(x) === 'function';
  }
  var isArray = isFunction(Array.isArray) ? Array.isArray : function isArray(x) {
    return type(x) === 'array';
  };

  /*!
   * @jsmini/extend 0.3.3 (https://github.com/jsmini/extend)
   * API https://github.com/jsmini/extend/blob/master/doc/api.md
   * Copyright 2017-2019 jsmini. All Rights Reserved
   * Licensed under MIT (https://github.com/jsmini/extend/blob/master/LICENSE)
   */

  function hasOwnProp(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
  }

  var assign = isFunction(Object.assign) ? Object.assign : function assign(target) {
    if (!isObject(target)) {
      throw new TypeError('assign first param must is object');
    }

    for (var i = 0; i < (arguments.length <= 1 ? 0 : arguments.length - 1); i++) {
      var source = i + 1 < 1 || arguments.length <= i + 1 ? undefined : arguments[i + 1];

      if (isObject(source)) {
        for (var key in source) {
          if (hasOwnProp(source, key)) {
            target[key] = source[key];
          }
        }
      }
    }

    return target;
  };
  function extend() {
    return assign.apply(void 0, arguments);
  }
  function extendDeep(target) {
    // 深拷贝
    if (!isObject(target) && !isArray(target)) {
      throw new TypeError('extend target param must is object');
    }

    for (var i = 0; i < (arguments.length <= 1 ? 0 : arguments.length - 1); i++) {
      var source = i + 1 < 1 || arguments.length <= i + 1 ? undefined : arguments[i + 1];

      for (var name in source) {
        var src = target[name];
        var copy = source[name]; //避免无限循环

        if (target === copy) {
          continue;
        } // 非可枚举属性


        if (!hasOwnProp(source, name)) {
          continue;
        }

        var copyIsArr = void 0;

        if (copy && (isObject(copy) || (copyIsArr = isArray(copy)))) {
          var clone = void 0;

          if (copyIsArr) {
            clone = src && isArray(src) ? src : [];
          } else {
            clone = src && isObject(src) ? src : {};
          }

          target[name] = extendDeep(clone, copy);
        } else if (typeof copy !== 'undefined') {
          target[name] = copy;
        }
      }
    }

    return target;
  }

  /*!
   * @templatejs/parser 2.1.0 (https://github.com/templatejs/parser)
   * API https://github.com/templatejs/parser/blob/master/doc/api.md
   * Copyright 2017-2019 templatejs. All Rights Reserved
   * Licensed under MIT (https://github.com/templatejs/parser/blob/master/LICENSE)
   */

  var defaultOpt = { sTag: '<%', eTag: '%>', escape: true };
  function parsehtml(line) {
      // 单双引号转义
      line = String(line).replace(/('|")/g, '\\$1');
      var lineList = line.split(/\r\n|\n/);
      var code = '';
      for (var i = 0; i < lineList.length; i++) {
          code += ';__code__ += ("' + lineList[i] + (i === lineList.length - 1 ? '")\n' : '\\n")\n');
      }
      return code;
  }
  function parsejs(line, escape) {
      if (escape === void 0) { escape = true; }
      line = String(line);
      escape = !!escape;
      //var reg = /^(:?)(.*?)=(.*)$/;
      var reg = /^(?:=|(:.*?)=)(.*)$/;
      var html;
      var arr;
      var modifier;
      // = := :*=
      // :h=123 [':h=123', 'h', '123']
      if (arr = reg.exec(line)) {
          html = arr[2]; // 输出
          if (arr[1]) {
              // :开头
              modifier = arr[1].slice(1);
          }
          else {
              // = 开头
              modifier = escape ? 'h' : '';
          }
          return ';__code__ += __modifierMap__["' + modifier + '"](typeof (' + html + ') !== "undefined" ? (' + html + ') : "")\n';
      }
      //原生js
      return ';' + line + '\n';
  }
  function parse(tpl, opt) {
      if (opt === void 0) { opt = defaultOpt; }
      var _a = extendDeep({}, defaultOpt, opt), sTag = _a.sTag, eTag = _a.eTag, escape = _a.escape;
      tpl = String(tpl);
      var code = '';
      var tokens = tpl.split(sTag);
      for (var i = 0, len = tokens.length; i < len; i++) {
          var token = tokens[i].split(eTag);
          if (token.length === 1) {
              // html
              // <div></div>
              code += parsehtml(token[0]);
          }
          else {
              // js
              // <%= a%>
              code += parsejs(token[0], escape);
              if (token[1]) {
                  // js + html
                  // <%if () {%> html <%}%>
                  code += parsehtml(token[1]);
              }
          }
      }
      return code;
  }

  /*!
   * @templatejs/runtime 2.1.0 (https://github.com/yanhaijing/runtime)
   * API https://github.com/yanhaijing/runtime/blob/master/doc/api.md
   * Copyright 2017-2019 yanhaijing. All Rights Reserved
   * Licensed under MIT (https://github.com/yanhaijing/runtime/blob/master/LICENSE)
   */

  var o = {
      sTag: '<%',
      eTag: '%>',
      compress: false,
      escape: true,
      error: function () { } //错误回调
  };
  function clone() {
      var args = [];
      for (var _i = 0; _i < arguments.length; _i++) {
          args[_i] = arguments[_i];
      }
      return extend.apply(null, [{}].concat(args));
  }
  function nothing(param) {
      return param;
  }
  function encodeHTML(source) {
      return String(source)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/\\/g, '&#92;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
  }
  var functionMap = {}; //内部函数对象
  //修饰器前缀
  var modifierMap = {
      '': function (param) { return nothing(param); },
      'h': function (param) { return encodeHTML(param); },
      'u': function (param) { return encodeURI(param); }
  };
  function consoleAdapter(cmd, msg) {
      typeof console !== 'undefined' && console[cmd] && console[cmd](msg);
  }
  function runtime() { }
  runtime.config = function (option) {
      if (type(option) === 'object') {
          o = extend(o, option);
      }
      return clone(o);
  };
  runtime.compress = function (html) {
      return String(html).replace(/\s+/g, ' ').replace(/<!--[\w\W]*?-->/g, '');
  };
  runtime.handelError = function handelError(e) {
      var message = 'template.js error\n\n';
      for (var key in e) {
          message += '<' + key + '>\n' + e[key] + '\n\n';
      }
      message += '<message>\n' + e.message + '\n\n';
      consoleAdapter('error', message);
      o.error(e);
      function error() {
          return 'template.js error';
      }
      error.toString = function () {
          return '__code__ = "template.js error"';
      };
      return error;
  };
  runtime.registerFunction = function (name, fn) {
      if (typeof name !== 'string') {
          return clone(functionMap);
      }
      if (type(fn) !== 'function') {
          return functionMap[name];
      }
      return functionMap[name] = fn;
  };
  runtime.unregisterFunction = function (name) {
      if (typeof name !== 'string') {
          return false;
      }
      delete functionMap[name];
      return true;
  };
  runtime.registerModifier = function (name, fn) {
      if (typeof name !== 'string') {
          return clone(modifierMap);
      }
      if (type(fn) !== 'function') {
          return modifierMap[name];
      }
      return modifierMap[name] = fn;
  };
  runtime.unregisterModifier = function (name) {
      if (typeof name !== 'string') {
          return false;
      }
      delete modifierMap[name];
      return true;
  };
  runtime.encodeHTML = encodeHTML;
  runtime.functionMap = functionMap;
  runtime.modifierMap = modifierMap;
  runtime.o = o;

  var encodeHTML$1 = runtime.encodeHTML, compress = runtime.compress, handelError = runtime.handelError, o$1 = runtime.o, functionMap$1 = runtime.functionMap, modifierMap$1 = runtime.modifierMap;
  function clone$1() {
      var args = [];
      for (var _i = 0; _i < arguments.length; _i++) {
          args[_i] = arguments[_i];
      }
      return extend.apply(null, [{}].concat(args));
  }
  function compiler(tpl, opt) {
      if (opt === void 0) { opt = o$1; }
      var mainCode = parse(tpl, opt);
      var headerCode = '\n' +
          '    var html = (function (__data__, __modifierMap__) {\n' +
          '        var __str__ = "", __code__ = "";\n' +
          '        for(var key in __data__) {\n' +
          '            __str__+=("var " + key + "=__data__[\'" + key + "\'];");\n' +
          '        }\n' +
          '        eval(__str__);\n\n';
      var footerCode = '\n' +
          '        ;return __code__;\n' +
          '    }(__data__, __modifierMap__));\n' +
          '    return html;\n';
      var code = headerCode + mainCode + footerCode;
      code = code.replace(/[\r]/g, ' '); // ie 7 8 会报错，不知道为什么
      try {
          var Render = new Function('__data__', '__modifierMap__', code);
          Render.toString = function () {
              return mainCode;
          };
          return Render;
      }
      catch (e) {
          e.temp = 'function anonymous(__data__, __modifierMap__) {' + code + '}';
          throw e;
      }
  }
  function compile(tpl, opt) {
      if (opt === void 0) { opt = o$1; }
      opt = clone$1(o$1, opt);
      try {
          var Render = compiler(tpl, opt);
      }
      catch (e) {
          e.name = 'CompileError';
          e.tpl = tpl;
          e.render = e.temp;
          delete e.temp;
          return handelError(e);
      }
      function render(data) {
          data = clone$1(functionMap$1, data);
          try {
              var html = Render(data, modifierMap$1);
              html = opt.compress ? compress(html) : html;
              return html;
          }
          catch (e) {
              e.name = 'RenderError';
              e.tpl = tpl;
              e.render = Render.toString();
              return handelError(e)();
          }
      }
      render.toString = function () {
          return Render.toString();
      };
      return render;
  }
  function template(tpl, data) {
      if (typeof tpl !== 'string') {
          return '';
      }
      var fn = compile(tpl);
      if (type(data) !== 'object') {
          return fn;
      }
      return fn(data);
  }
  template.config = function (option) {
      return runtime.config(option);
  };
  template.registerFunction = function (name, fn) {
      return runtime.registerFunction(name, fn);
  };
  template.unregisterFunction = function (name) {
      return runtime.unregisterFunction(name);
  };
  template.registerModifier = function (name, fn) {
      return runtime.registerModifier(name, fn);
  };
  template.unregisterModifier = function (name) {
      return runtime.unregisterModifier(name);
  };
  // 兼容runtime, 预编译插件可以引用runtime，也可以引用template
  template.encodeHTML = encodeHTML$1;
  template.compress = compress;
  template.handelError = handelError;
  template.functionMap = functionMap$1;
  template.modifierMap = modifierMap$1;
  // 兼容旧版本
  template.__encodeHTML = encodeHTML$1;
  template.__compress = compress;
  template.__handelError = handelError;
  template.__compile = compile;

  return template;

})));

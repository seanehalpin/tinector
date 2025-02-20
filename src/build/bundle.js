
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(window.document);
var ui = (function () {
    'use strict';

    function noop() { }
    const identity = x => x;
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function split_css_unit(value) {
        const split = typeof value === 'string' && value.match(/^\s*(-?[\d.]+)([^\s]*)\s*$/);
        return split ? [parseFloat(split[1]), split[2] || 'px'] : [value, 'px'];
    }

    const is_client = typeof window !== 'undefined';
    let now = is_client
        ? () => window.performance.now()
        : () => Date.now();
    let raf = is_client ? cb => requestAnimationFrame(cb) : noop;

    const tasks = new Set();
    function run_tasks(now) {
        tasks.forEach(task => {
            if (!task.c(now)) {
                tasks.delete(task);
                task.f();
            }
        });
        if (tasks.size !== 0)
            raf(run_tasks);
    }
    /**
     * Creates a new task that runs on each raf frame
     * until it returns a falsy value or is aborted
     */
    function loop(callback) {
        let task;
        if (tasks.size === 0)
            raf(run_tasks);
        return {
            promise: new Promise(fulfill => {
                tasks.add(task = { c: callback, f: fulfill });
            }),
            abort() {
                tasks.delete(task);
            }
        };
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);
    function append(target, node) {
        target.appendChild(node);
    }
    function append_styles(target, style_sheet_id, styles) {
        const append_styles_to = get_root_for_style(target);
        if (!append_styles_to.getElementById(style_sheet_id)) {
            const style = element('style');
            style.id = style_sheet_id;
            style.textContent = styles;
            append_stylesheet(append_styles_to, style);
        }
    }
    function get_root_for_style(node) {
        if (!node)
            return document;
        const root = node.getRootNode ? node.getRootNode() : node.ownerDocument;
        if (root && root.host) {
            return root;
        }
        return node.ownerDocument;
    }
    function append_empty_stylesheet(node) {
        const style_element = element('style');
        append_stylesheet(get_root_for_style(node), style_element);
        return style_element.sheet;
    }
    function append_stylesheet(node, style) {
        append(node.head || node, style);
        return style.sheet;
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        if (node.parentNode) {
            node.parentNode.removeChild(node);
        }
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function svg_element(name) {
        return document.createElementNS('http://www.w3.org/2000/svg', name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_style(node, key, value, important) {
        if (value == null) {
            node.style.removeProperty(key);
        }
        else {
            node.style.setProperty(key, value, important ? 'important' : '');
        }
    }
    function toggle_class(element, name, toggle) {
        element.classList[toggle ? 'add' : 'remove'](name);
    }
    function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, cancelable, detail);
        return e;
    }

    // we need to store the information for multiple documents because a Svelte application could also contain iframes
    // https://github.com/sveltejs/svelte/issues/3624
    const managed_styles = new Map();
    let active = 0;
    // https://github.com/darkskyapp/string-hash/blob/master/index.js
    function hash(str) {
        let hash = 5381;
        let i = str.length;
        while (i--)
            hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
        return hash >>> 0;
    }
    function create_style_information(doc, node) {
        const info = { stylesheet: append_empty_stylesheet(node), rules: {} };
        managed_styles.set(doc, info);
        return info;
    }
    function create_rule(node, a, b, duration, delay, ease, fn, uid = 0) {
        const step = 16.666 / duration;
        let keyframes = '{\n';
        for (let p = 0; p <= 1; p += step) {
            const t = a + (b - a) * ease(p);
            keyframes += p * 100 + `%{${fn(t, 1 - t)}}\n`;
        }
        const rule = keyframes + `100% {${fn(b, 1 - b)}}\n}`;
        const name = `__svelte_${hash(rule)}_${uid}`;
        const doc = get_root_for_style(node);
        const { stylesheet, rules } = managed_styles.get(doc) || create_style_information(doc, node);
        if (!rules[name]) {
            rules[name] = true;
            stylesheet.insertRule(`@keyframes ${name} ${rule}`, stylesheet.cssRules.length);
        }
        const animation = node.style.animation || '';
        node.style.animation = `${animation ? `${animation}, ` : ''}${name} ${duration}ms linear ${delay}ms 1 both`;
        active += 1;
        return name;
    }
    function delete_rule(node, name) {
        const previous = (node.style.animation || '').split(', ');
        const next = previous.filter(name
            ? anim => anim.indexOf(name) < 0 // remove specific animation
            : anim => anim.indexOf('__svelte') === -1 // remove all Svelte animations
        );
        const deleted = previous.length - next.length;
        if (deleted) {
            node.style.animation = next.join(', ');
            active -= deleted;
            if (!active)
                clear_rules();
        }
    }
    function clear_rules() {
        raf(() => {
            if (active)
                return;
            managed_styles.forEach(info => {
                const { ownerNode } = info.stylesheet;
                // there is no ownerNode if it runs on jsdom.
                if (ownerNode)
                    detach(ownerNode);
            });
            managed_styles.clear();
        });
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    /**
     * The `onMount` function schedules a callback to run as soon as the component has been mounted to the DOM.
     * It must be called during the component's initialisation (but doesn't need to live *inside* the component;
     * it can be called from an external module).
     *
     * `onMount` does not run inside a [server-side component](/docs#run-time-server-side-component-api).
     *
     * https://svelte.dev/docs#run-time-svelte-onmount
     */
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }

    const dirty_components = [];
    const binding_callbacks = [];
    let render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = /* @__PURE__ */ Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        // Do not reenter flush while dirty components are updated, as this can
        // result in an infinite loop. Instead, let the inner flush handle it.
        // Reentrancy is ok afterwards for bindings etc.
        if (flushidx !== 0) {
            return;
        }
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            try {
                while (flushidx < dirty_components.length) {
                    const component = dirty_components[flushidx];
                    flushidx++;
                    set_current_component(component);
                    update(component.$$);
                }
            }
            catch (e) {
                // reset dirty state to not end up in a deadlocked state and then rethrow
                dirty_components.length = 0;
                flushidx = 0;
                throw e;
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    /**
     * Useful for example to execute remaining `afterUpdate` callbacks before executing `destroy`.
     */
    function flush_render_callbacks(fns) {
        const filtered = [];
        const targets = [];
        render_callbacks.forEach((c) => fns.indexOf(c) === -1 ? filtered.push(c) : targets.push(c));
        targets.forEach((c) => c());
        render_callbacks = filtered;
    }

    let promise;
    function wait() {
        if (!promise) {
            promise = Promise.resolve();
            promise.then(() => {
                promise = null;
            });
        }
        return promise;
    }
    function dispatch(node, direction, kind) {
        node.dispatchEvent(custom_event(`${direction ? 'intro' : 'outro'}${kind}`));
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
        else if (callback) {
            callback();
        }
    }
    const null_transition = { duration: 0 };
    function create_in_transition(node, fn, params) {
        const options = { direction: 'in' };
        let config = fn(node, params, options);
        let running = false;
        let animation_name;
        let task;
        let uid = 0;
        function cleanup() {
            if (animation_name)
                delete_rule(node, animation_name);
        }
        function go() {
            const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
            if (css)
                animation_name = create_rule(node, 0, 1, duration, delay, easing, css, uid++);
            tick(0, 1);
            const start_time = now() + delay;
            const end_time = start_time + duration;
            if (task)
                task.abort();
            running = true;
            add_render_callback(() => dispatch(node, true, 'start'));
            task = loop(now => {
                if (running) {
                    if (now >= end_time) {
                        tick(1, 0);
                        dispatch(node, true, 'end');
                        cleanup();
                        return running = false;
                    }
                    if (now >= start_time) {
                        const t = easing((now - start_time) / duration);
                        tick(t, 1 - t);
                    }
                }
                return running;
            });
        }
        let started = false;
        return {
            start() {
                if (started)
                    return;
                started = true;
                delete_rule(node);
                if (is_function(config)) {
                    config = config(options);
                    wait().then(go);
                }
                else {
                    go();
                }
            },
            invalidate() {
                started = false;
            },
            end() {
                if (running) {
                    cleanup();
                    running = false;
                }
            }
        };
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
                // if the component was destroyed immediately
                // it will update the `$$.on_destroy` reference to `null`.
                // the destructured on_destroy may still reference to the old array
                if (component.$$.on_destroy) {
                    component.$$.on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            flush_render_callbacks($$.after_update);
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: [],
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            if (!is_function(callback)) {
                return noop;
            }
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.59.2' }, detail), { bubbles: true }));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation, has_stop_immediate_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        if (has_stop_immediate_propagation)
            modifiers.push('stopImmediatePropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function prop_dev(node, property, value) {
        node[property] = value;
        dispatch_dev('SvelteDOMSetProperty', { node, property, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.data === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    function styleInject(css, ref) {
      if ( ref === void 0 ) ref = {};
      var insertAt = ref.insertAt;

      if (!css || typeof document === 'undefined') { return; }

      var head = document.head || document.getElementsByTagName('head')[0];
      var style = document.createElement('style');
      style.type = 'text/css';

      if (insertAt === 'top') {
        if (head.firstChild) {
          head.insertBefore(style, head.firstChild);
        } else {
          head.appendChild(style);
        }
      } else {
        head.appendChild(style);
      }

      if (style.styleSheet) {
        style.styleSheet.cssText = css;
      } else {
        style.appendChild(document.createTextNode(css));
      }
    }

    var css_248z = ":root{--font-stack:\"Inter\",sans-serif;--font-mono:\"Courier New\",Courier,Consolas,monaco,monospace;--zindex-base:-1;--zindex-1:1;--zindex-content:50;--zindex-modal:1000;--zindex-modal-base:900;--zindex-top:10000000;--shadow-modal:0px 2px 4px rgba(0,0,0,.2);--6px:0.375rem;--8px:0.5rem;--12px:0.75rem;--13px:0.8125rem;--14px:0.875rem;--15px:0.9375rem;--16px:1rem;--17px:1.0625rem;--18px:1.125rem;--19px:1.1875rem;--20px:1.25rem;--22px:1.375rem;--21px:1.3125rem;--24px:1.5rem;--32px:2rem;--42px:2.652rem;--64px:4rem;--72px:4.5rem;--curve:cubic-bezier(0.68,-0.55,0.265,1.55);--bounce:all 0.3s var(--curve);--font-sm:11px;--font-sd:12px;--font-sd-lh:16px;--font-lg:16px;--font-xl:22px;--font-w-sd:400;--font-w-md:500;--font-ls-sm:0.12px;--radius-sd:2px;--radius-lg:6px;--size-md:30px;--pad-xs:10px;--pad-sm:16px;--color-white:#fff;--color-prompt-text:#fff;--color-dark-gradient:linear-gradient(180deg,rgba(0,0,0,.5),transparent);--color-transparent-gradient:linear-gradient(180deg,transparent,transparent);--color-rainbow:conic-gradient(from 129.15deg at 50% 50%,#ffc062 -79.73deg,#1abcfe 1.15deg,#0acf83 78.48deg,#a259ff 144.34deg,#f21e6a 208.99deg,#ffc062 280.27deg,#1abcfe 361.15deg);--color-alt-rainbow:conic-gradient(from 90deg at 50% 50%,#e164ef 0deg,#1fc8ff 72.0000010728836deg,#b6ff95 144.0000021457672deg,#fdf186 216.00000858306885deg,#f4bb40 288.0000042915344deg,#e164ef 360deg);--color-overlay-bg:#fff;--color-overlay-hover:var(--figma-color-bg-secondary);--logo-shadow:inset 0 0 1px rgba(0,0,0,.3);--shadow-modal:0 0 0 1px var(--figma-color-border),0px 23px 6px 0px hsla(0,0%,67%,0),0px 14px 6px 0px hsla(0,0%,67%,.01),0px 8px 5px 0px hsla(0,0%,67%,.05),0px 4px 4px 0px hsla(0,0%,67%,.09),0px 1px 2px 0px hsla(0,0%,67%,.1);--color-bg-twist:var(--figma-color-bg-secondary)}*{box-sizing:border-box}body,html{position:relative}body{background:var(--figma-color-bg);color:var(--figma-color-text);font-family:var(--font-stack);font-size:var(--font-sd);margin:0;overflow-x:hidden;padding:0}.avatar img{transform:scale3d(.5,.5,.5)}a:focus-visible,button:focus-visible,input:focus-visible{border-radius:1px;opacity:1;outline:2px solid var(--figma-color-border-selected);outline-offset:1px}a:active,button:active,input:active{outline:0}.prompt.edit,.prompt.redo{--color-prompt-text:#222}.figma-dark{--color-overlay-bg:#383838;--color-overlay-hover:var(--figma-color-bg-tertiary);--shadow-modal:0 0 0 1px var(--figma-color-border),0px 20px 6px 0px transparent,0px 13px 5px 0px rgba(0,0,0,.01),0px 7px 4px 0px rgba(0,0,0,.05),0px 3px 3px 0px rgba(0,0,0,.09),0px 1px 2px 0px rgba(0,0,0,.1);--logo-shadow:inset 0 0 1px hsla(0,0%,100%,.8);--color-prompt-text:#fff;--color-bg-twist:var(--figma-color-bg)}.figma-dark .prompt.edit,.figma-dark .prompt.redo{--color-prompt-text:#fff}.figma-dark .auto,.figma-dark .pick{filter:none!important}";
    styleInject(css_248z);

    function backOut(t) {
        const s = 1.70158;
        return --t * t * ((s + 1) * t + s) + 1;
    }
    function cubicOut(t) {
        const f = t - 1.0;
        return f * f * f + 1.0;
    }

    function fly(node, { delay = 0, duration = 400, easing = cubicOut, x = 0, y = 0, opacity = 0 } = {}) {
        const style = getComputedStyle(node);
        const target_opacity = +style.opacity;
        const transform = style.transform === 'none' ? '' : style.transform;
        const od = target_opacity * (1 - opacity);
        const [xValue, xUnit] = split_css_unit(x);
        const [yValue, yUnit] = split_css_unit(y);
        return {
            delay,
            duration,
            easing,
            css: (t, u) => `
			transform: ${transform} translate(${(1 - t) * xValue}${xUnit}, ${(1 - t) * yValue}${yUnit});
			opacity: ${target_opacity - (od * u)}`
        };
    }

    /* src/components/IconSettings.svelte generated by Svelte v3.59.2 */

    const file = "src/components/IconSettings.svelte";

    function create_fragment(ctx) {
    	let svg;
    	let path0;
    	let path1;

    	const block = {
    		c: function create() {
    			svg = svg_element("svg");
    			path0 = svg_element("path");
    			path1 = svg_element("path");
    			attr_dev(path0, "d", "M12 14.5C13.3807 14.5 14.5 13.3807 14.5 12C14.5 10.6193 13.3807 9.5 12 9.5C10.6193 9.5 9.5 10.6193 9.5 12C9.5 13.3807 10.6193 14.5 12 14.5Z");
    			attr_dev(path0, "stroke", "currentColor");
    			attr_dev(path0, "stroke-linecap", "round");
    			attr_dev(path0, "stroke-linejoin", "round");
    			add_location(path0, file, 0, 117, 117);
    			attr_dev(path1, "d", "M12.1281 16.8819C12.0444 16.8819 11.96 16.8819 11.8781 16.8819L9.87502 18C9.09522 17.7377 8.37194 17.3306 7.74314 16.8L7.73564 14.55C7.69127 14.48 7.64939 14.4094 7.61064 14.3369L5.61877 13.2025C5.46188 12.4089 5.46188 11.5923 5.61877 10.7987L7.60877 9.6675C7.64939 9.59563 7.69127 9.52437 7.73377 9.45437L7.74377 7.20438C8.37199 6.67228 9.09509 6.26365 9.87502 6L11.875 7.11812C11.9588 7.11812 12.0431 7.11812 12.125 7.11812L14.125 6C14.9048 6.2623 15.6281 6.66943 16.2569 7.2L16.2644 9.45C16.3088 9.52 16.3506 9.59063 16.3894 9.66313L18.38 10.7969C18.5369 11.5904 18.5369 12.4071 18.38 13.2006L16.39 14.3319C16.3494 14.4037 16.3075 14.475 16.265 14.545L16.255 16.795C15.6272 17.3272 14.9045 17.736 14.125 18L12.1281 16.8819Z");
    			attr_dev(path1, "stroke", "currentColor");
    			attr_dev(path1, "stroke-linecap", "round");
    			attr_dev(path1, "stroke-linejoin", "round");
    			add_location(path1, file, 0, 343, 343);
    			attr_dev(svg, "width", "24");
    			attr_dev(svg, "height", "24");
    			attr_dev(svg, "viewBox", "0 0 24 24");
    			attr_dev(svg, "fill", "none");
    			attr_dev(svg, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg, "class", "svelte-ewn6oi");
    			add_location(svg, file, 0, 0, 0);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, svg, anchor);
    			append_dev(svg, path0);
    			append_dev(svg, path1);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(svg);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('IconSettings', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<IconSettings> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class IconSettings extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "IconSettings",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    /* src/PluginUI.svelte generated by Svelte v3.59.2 */

    const { console: console_1 } = globals;
    const file$1 = "src/PluginUI.svelte";

    function add_css(target) {
    	append_styles(target, "svelte-67ony5", ".plugin-container.svelte-67ony5{padding:0;font-family:\"Inter\", sans-serif;color:var(--figma-color-text);position:relative}.button-holder.svelte-67ony5{position:fixed;bottom:16px;right:16px;z-index:1000;width:calc(100% - 32px);display:flex;gap:8px}.settings.svelte-67ony5{padding:0;border:1px solid var(--figma-color-border);display:flex;align-items:center;justify-content:center;border-radius:6px;height:30px;width:30px;cursor:pointer;color:var(--figma-color-text-secondary);background:var(--figma-color-bg-secondary)}.create-button.svelte-67ony5{flex:1;width:100%;font-size:11px;display:flex;justify-content:center;align-items:center;height:30px;padding:0 16px;border-radius:6px;border:none;background:var(--figma-color-bg-brand);color:var(--figma-color-text-onbrand);cursor:pointer}.create-button.svelte-67ony5:hover:not(.disabled){background:var(--figma-color-bg-brand-hover)}.create-button.disabled.svelte-67ony5{opacity:0.5;cursor:not-allowed;pointer-events:none}.frames-list.svelte-67ony5{padding:16px;height:100%;display:flex;flex-direction:column;gap:8px;align-items:center;justify-content:center;background:var(--figma-color-bg-secondary);background-size:14px 14px;background-image:radial-gradient(var(--figma-color-bg-tertiary) 1px, transparent 1px)}.frame-item.svelte-67ony5{padding:6px 8px;border-radius:14px;width:100%;backdrop-filter:blur(10px)}.frame-block.svelte-67ony5{border-radius:10px;width:30px;height:30px;background:var(--figma-color-bg-secondary)}.empty-state.svelte-67ony5{color:var(--figma-color-text-tertiary);font-size:11px;text-align:center;margin:0 0 12px 0}.noty.svelte-67ony5{flex:1;display:flex;width:100%;background:var(--figma-color-bg-danger);color:var(--figma-color-text-ondanger);padding:8px;border-radius:6px;font-size:11px;text-align:center;align-items:center;justify-content:center}.connections-list.svelte-67ony5{display:flex;flex-direction:column;gap:4px;padding:16px;overflow:scroll;margin-bottom:56px}.connection-item.svelte-67ony5{display:flex;justify-content:space-between;align-items:center;padding:6px 8px;background:var(--figma-color-bg-secondary);border-radius:8px}.connection-name.svelte-67ony5{font-size:11px;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-right:8px}.delete-button.svelte-67ony5{background:none;border:none;color:var(--figma-color-text-secondary);cursor:pointer;display:flex;align-items:center;justify-content:center;height:20px;width:20px;font-size:14px;line-height:1;border-radius:6px}.delete-button.svelte-67ony5:hover{color:var(--figma-color-text-ondanger);background:var(--figma-color-bg-danger)}.connections.svelte-67ony5{position:fixed;left:0;top:0;z-index:999;background:var(--figma-color-bg);height:100%;width:100%;overflow:scroll}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUGx1Z2luVUkuc3ZlbHRlIiwic291cmNlcyI6WyJQbHVnaW5VSS5zdmVsdGUiXSwic291cmNlc0NvbnRlbnQiOlsiPHNjcmlwdCBsYW5nPVwidHNcIj5pbXBvcnQgJy4vc3R5bGUuc2Nzcyc7XG5pbXBvcnQgeyBmbHkgfSBmcm9tICdzdmVsdGUvdHJhbnNpdGlvbic7XG5pbXBvcnQgeyBiYWNrT3V0IH0gZnJvbSBcInN2ZWx0ZS9lYXNpbmdcIjtcbmltcG9ydCB7IG9uTW91bnQgfSBmcm9tICdzdmVsdGUnO1xuaW1wb3J0IEljb25TZXR0aW5ncyBmcm9tICcuL2NvbXBvbmVudHMvSWNvblNldHRpbmdzLnN2ZWx0ZSc7XG5sZXQgY29ubmVjdGlvbnMgPSBbXTtcbmxldCBzZWxlY3RlZEluc3RhbmNlcyA9IFtdO1xubGV0IGVycm9yTWVzc2FnZSA9IG51bGw7XG4vLyBIZWxwZXIgdG8gY29udmVydCBbMCwxXSByZ2JhIHRvIENTUyBzdHJpbmcuXG4vLyBJZiBvdmVycmlkZUFscGhhIGlzIHByb3ZpZGVkLCB0aGF0IHZhbHVlIGlzIHVzZWQgZm9yIHRoZSBhbHBoYS5cbmZ1bmN0aW9uIHJnYmFUb0NzcyhyZ2JhLCBvdmVycmlkZUFscGhhKSB7XG4gICAgY29uc3QgciA9IE1hdGgucm91bmQocmdiYS5yICogMjU1KTtcbiAgICBjb25zdCBnID0gTWF0aC5yb3VuZChyZ2JhLmcgKiAyNTUpO1xuICAgIGNvbnN0IGIgPSBNYXRoLnJvdW5kKHJnYmEuYiAqIDI1NSk7XG4gICAgY29uc3QgYSA9IG92ZXJyaWRlQWxwaGEgIT09IHVuZGVmaW5lZCA/IG92ZXJyaWRlQWxwaGEgOiByZ2JhLmE7XG4gICAgcmV0dXJuIGByZ2JhKCR7cn0sICR7Z30sICR7Yn0sICR7YX0pYDtcbn1cbi8vIEhhbmRsZSBtZXNzYWdlcyBmcm9tIEZpZ21hXG5vbk1vdW50KCgpID0+IHtcbiAgICB3aW5kb3cub25tZXNzYWdlID0gKGV2ZW50KSA9PiB7XG4gICAgICAgIGNvbnN0IG1zZyA9IGV2ZW50LmRhdGEucGx1Z2luTWVzc2FnZTtcbiAgICAgICAgLy8gY29uc29sZS5sb2coJ1JlY2VpdmVkIG1lc3NhZ2U6JywgbXNnLnR5cGUpO1xuICAgICAgICBzd2l0Y2ggKG1zZy50eXBlKSB7XG4gICAgICAgICAgICBjYXNlICdDT05ORUNUSU9OU19VUERBVEVEJzpcbiAgICAgICAgICAgICAgICAvLyBjb25zb2xlLmxvZygnQ29ubmVjdGlvbnMgdXBkYXRlZDonLCBtc2cuY29ubmVjdGlvbnMpO1xuICAgICAgICAgICAgICAgIGNvbm5lY3Rpb25zID0gbXNnLmNvbm5lY3Rpb25zO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSAnSU5TVEFOQ0VTX1NFTEVDVEVEJzpcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnSW5zdGFuY2VzIHNlbGVjdGVkOicsIG1zZy5pbnN0YW5jZXMpO1xuICAgICAgICAgICAgICAgIHNlbGVjdGVkSW5zdGFuY2VzID0gbXNnLmluc3RhbmNlcztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgJ0VSUk9SJzpcbiAgICAgICAgICAgICAgICBzaG93RXJyb3IobXNnLm1lc3NhZ2UpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgfTtcbn0pO1xuZnVuY3Rpb24gc2hvd0Vycm9yKG1lc3NhZ2UpIHtcbiAgICBlcnJvck1lc3NhZ2UgPSBtZXNzYWdlO1xuICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICBlcnJvck1lc3NhZ2UgPSBudWxsO1xuICAgIH0sIDMwMDApO1xufVxuZnVuY3Rpb24gY3JlYXRlQ29ubmVjdGlvbigpIHtcbiAgICBpZiAoc2VsZWN0ZWRJbnN0YW5jZXMubGVuZ3RoICE9PSAyKSB7XG4gICAgICAgIHNob3dFcnJvcignU2VsZWN0IGV4YWN0bHkgdHdvIGluc3RhbmNlcyB0byBjb25uZWN0Jyk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3QgbWVzc2FnZSA9IHtcbiAgICAgICAgdHlwZTogJ0NSRUFURV9DT05ORUNUSU9OJyxcbiAgICAgICAgc291cmNlSWQ6IHNlbGVjdGVkSW5zdGFuY2VzWzBdLmlkLFxuICAgICAgICB0YXJnZXRJZDogc2VsZWN0ZWRJbnN0YW5jZXNbMV0uaWRcbiAgICB9O1xuICAgIHBhcmVudC5wb3N0TWVzc2FnZSh7IHBsdWdpbk1lc3NhZ2U6IG1lc3NhZ2UgfSwgJyonKTtcbn1cbmZ1bmN0aW9uIGRlbGV0ZUNvbm5lY3Rpb24obmFtZSkge1xuICAgIHBhcmVudC5wb3N0TWVzc2FnZSh7XG4gICAgICAgIHBsdWdpbk1lc3NhZ2U6IHtcbiAgICAgICAgICAgIHR5cGU6ICdERUxFVEVfQ09OTkVDVElPTicsXG4gICAgICAgICAgICBjb25uZWN0aW9uTmFtZTogbmFtZVxuICAgICAgICB9XG4gICAgfSwgJyonKTtcbn1cbmxldCBzaG93Q29ubmVjdGlvbnMgPSBmYWxzZTtcbjwvc2NyaXB0PlxuXG48ZGl2IGNsYXNzPVwicGx1Z2luLWNvbnRhaW5lclwiPlxuICB7I2lmIGVycm9yTWVzc2FnZX1cbiAgICA8ZGl2IGNsYXNzPVwiZXJyb3ItbWVzc2FnZVwiPlxuICAgICAge2Vycm9yTWVzc2FnZX1cbiAgICA8L2Rpdj5cbiAgey9pZn1cblxuICA8ZGl2IGNsYXNzPVwic2VjdGlvblwiPlxuXG4gICAgeyNpZiBzaG93Q29ubmVjdGlvbnN9XG4gIDxkaXYgY2xhc3M9XCJjb25uZWN0aW9uc1wiPlxuICAgIDxkaXYgY2xhc3M9XCJjb25uZWN0aW9ucy1saXN0XCI+XG4gICAgICB7I2lmIGNvbm5lY3Rpb25zLmxlbmd0aCA9PT0gMH1cbiAgICAgICAgPHAgY2xhc3M9XCJlbXB0eS1zdGF0ZVwiPk5vIGNvbm5lY3Rpb25zIHlldDwvcD5cbiAgICAgIHs6ZWxzZX1cbiAgICAgICAgeyNlYWNoIGNvbm5lY3Rpb25zIGFzIGNvbm5lY3Rpb259XG4gICAgICAgICAgPGRpdiBjbGFzcz1cImNvbm5lY3Rpb24taXRlbVwiPlxuICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJjb25uZWN0aW9uLW5hbWVcIj57Y29ubmVjdGlvbi5uYW1lfTwvc3Bhbj5cbiAgICAgICAgICAgIDxidXR0b24gXG4gICAgICAgICAgICAgIGNsYXNzPVwiZGVsZXRlLWJ1dHRvblwiIFxuICAgICAgICAgICAgICBvbjpjbGljaz17KCkgPT4gZGVsZXRlQ29ubmVjdGlvbihjb25uZWN0aW9uLm5hbWUpfVxuICAgICAgICAgICAgICB0aXRsZT1cIkRlbGV0ZSBjb25uZWN0aW9uXCJcbiAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgw5dcbiAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICB7L2VhY2h9XG4gICAgICB7L2lmfVxuICAgIDwvZGl2PlxuICA8L2Rpdj5cbiAgey9pZn1cblxuICAgIDxkaXYgY2xhc3M9XCJmcmFtZXMtbGlzdFwiPlxuICAgICAgeyNpZiBzZWxlY3RlZEluc3RhbmNlcy5sZW5ndGggPT09IDB9XG4gICAgICAgIDxwIGNsYXNzPVwiZW1wdHktc3RhdGVcIj5TZWxlY3QgdHdvIGNhcmRzIHRvIGNvbm5lY3Q8L3A+XG4gICAgICB7OmVsc2V9XG4gICAgICAgIHsjZWFjaCBzZWxlY3RlZEluc3RhbmNlcyBhcyBpbnN0YW5jZX1cbiAgICAgICAgICA8ZGl2IFxuICAgICAgICAgICAgY2xhc3M9XCJmcmFtZS1pdGVtXCJcbiAgICAgICAgICAgIHN0eWxlPVwiYmFja2dyb3VuZC1jb2xvcjoge2luc3RhbmNlLnJnYmEgPyByZ2JhVG9Dc3MoaW5zdGFuY2UucmdiYSwgMC4xKSA6ICd0cmFuc3BhcmVudCd9OyBib3JkZXI6IDFweCBzb2xpZCB7aW5zdGFuY2UucmdiYSA/IHJnYmFUb0NzcyhpbnN0YW5jZS5yZ2JhLCAwLjMpIDogJ3ZhcigtLWZpZ21hLWNvbG9yLWJvcmRlciknfTtcIlxuICAgICAgICAgICAgaW46Zmx5PXt7eTogMzAsIGR1cmF0aW9uOiAyMDAsIGVhc2luZzogYmFja091dCwgZGVsYXk6IDUwIH19XG4gICAgICAgICAgPlxuICAgICAgICAgICAgXG4gICAgICAgICAgPGRpdiBcbiAgICAgICAgICBjbGFzcz1cImZyYW1lLWJsb2NrXCJcbiAgICAgICAgICBzdHlsZT1cImJhY2tncm91bmQtY29sb3I6IHtpbnN0YW5jZS5yZ2JhID8gcmdiYVRvQ3NzKGluc3RhbmNlLnJnYmEsMSkgOiAndHJhbnNwYXJlbnQnfTtcIlxuICAgICAgICAgID48L2Rpdj5cblxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICB7L2VhY2h9XG4gICAgICB7L2lmfVxuICAgIDwvZGl2PlxuXG4gICAgeyNpZiBzaG93Q29ubmVjdGlvbnN9XG4gICAgPGRpdiBjbGFzcz1cImJ1dHRvbi1ob2xkZXJcIj5cbiAgICAgIDxidXR0b24gY2xhc3M9XCJjcmVhdGUtYnV0dG9uXCIgb246Y2xpY2s9eygpID0+IHNob3dDb25uZWN0aW9ucyA9IGZhbHNlfT5CYWNrPC9idXR0b24+XG4gICAgPC9kaXY+XG4gICAgezplbHNlfVxuICAgIDxkaXYgY2xhc3M9XCJidXR0b24taG9sZGVyXCI+XG4gICAgICA8YnV0dG9uIGNsYXNzPVwic2V0dGluZ3NcIiBvbjpjbGljaz17KCkgPT4gc2hvd0Nvbm5lY3Rpb25zID0gdHJ1ZX0+XG4gICAgICAgIDxJY29uU2V0dGluZ3MgLz5cbiAgICAgIDwvYnV0dG9uPlxuICAgICAgeyNpZiBzZWxlY3RlZEluc3RhbmNlcy5sZW5ndGggPj0gM31cbiAgICAgIDxkaXYgY2xhc3M9XCJub3R5XCI+XG4gICAgICAgIFR3byBjYXJkcyBvbmx5XG4gICAgICA8L2Rpdj5cbiAgICAgIHs6ZWxzZX1cbiAgICAgIDxidXR0b24gXG4gICAgICAgIGNsYXNzPVwiY3JlYXRlLWJ1dHRvblwiIFxuICAgICAgICBjbGFzczpkaXNhYmxlZD17c2VsZWN0ZWRJbnN0YW5jZXMubGVuZ3RoICE9PSAyfVxuICAgICAgICBvbjpjbGljaz17Y3JlYXRlQ29ubmVjdGlvbn1cbiAgICAgICAgZGlzYWJsZWQ9e3NlbGVjdGVkSW5zdGFuY2VzLmxlbmd0aCAhPT0gMn1cbiAgICAgID5cbiAgICAgICAgQ29ubmVjdFxuICAgICAgPC9idXR0b24+XG4gICAgICB7L2lmfVxuICAgIDwvZGl2PlxuICAgIHsvaWZ9XG4gIDwvZGl2PlxuXG4gIFxuICBcbjwvZGl2PlxuXG48c3R5bGUgbGFuZz1cInNjc3NcIj4ucGx1Z2luLWNvbnRhaW5lciB7XG4gIHBhZGRpbmc6IDA7XG4gIGZvbnQtZmFtaWx5OiBcIkludGVyXCIsIHNhbnMtc2VyaWY7XG4gIGNvbG9yOiB2YXIoLS1maWdtYS1jb2xvci10ZXh0KTtcbiAgcG9zaXRpb246IHJlbGF0aXZlO1xufVxuXG4uc2VjdGlvbi1oZWFkZXIge1xuICBkaXNwbGF5OiBmbGV4O1xuICBqdXN0aWZ5LWNvbnRlbnQ6IHNwYWNlLWJldHdlZW47XG4gIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gIG1hcmdpbi1ib3R0b206IDhweDtcbn1cblxuaDIge1xuICBmb250LXNpemU6IDExcHg7XG4gIGZvbnQtd2VpZ2h0OiA2MDA7XG4gIHRleHQtdHJhbnNmb3JtOiB1cHBlcmNhc2U7XG4gIGNvbG9yOiB2YXIoLS1maWdtYS1jb2xvci10ZXh0LXNlY29uZGFyeSk7XG4gIG1hcmdpbjogMDtcbn1cblxuLmJ1dHRvbi1ob2xkZXIge1xuICBwb3NpdGlvbjogZml4ZWQ7XG4gIGJvdHRvbTogMTZweDtcbiAgcmlnaHQ6IDE2cHg7XG4gIHotaW5kZXg6IDEwMDA7XG4gIHdpZHRoOiBjYWxjKDEwMCUgLSAzMnB4KTtcbiAgZGlzcGxheTogZmxleDtcbiAgZ2FwOiA4cHg7XG59XG5cbi5zZXR0aW5ncyB7XG4gIHBhZGRpbmc6IDA7XG4gIGJvcmRlcjogMXB4IHNvbGlkIHZhcigtLWZpZ21hLWNvbG9yLWJvcmRlcik7XG4gIGRpc3BsYXk6IGZsZXg7XG4gIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICBib3JkZXItcmFkaXVzOiA2cHg7XG4gIGhlaWdodDogMzBweDtcbiAgd2lkdGg6IDMwcHg7XG4gIGN1cnNvcjogcG9pbnRlcjtcbiAgY29sb3I6IHZhcigtLWZpZ21hLWNvbG9yLXRleHQtc2Vjb25kYXJ5KTtcbiAgYmFja2dyb3VuZDogdmFyKC0tZmlnbWEtY29sb3ItYmctc2Vjb25kYXJ5KTtcbn1cblxuLmNyZWF0ZS1idXR0b24ge1xuICBmbGV4OiAxO1xuICB3aWR0aDogMTAwJTtcbiAgZm9udC1zaXplOiAxMXB4O1xuICBkaXNwbGF5OiBmbGV4O1xuICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgaGVpZ2h0OiAzMHB4O1xuICBwYWRkaW5nOiAwIDE2cHg7XG4gIGJvcmRlci1yYWRpdXM6IDZweDtcbiAgYm9yZGVyOiBub25lO1xuICBiYWNrZ3JvdW5kOiB2YXIoLS1maWdtYS1jb2xvci1iZy1icmFuZCk7XG4gIGNvbG9yOiB2YXIoLS1maWdtYS1jb2xvci10ZXh0LW9uYnJhbmQpO1xuICBjdXJzb3I6IHBvaW50ZXI7XG59XG5cbi5jcmVhdGUtYnV0dG9uOmhvdmVyOm5vdCguZGlzYWJsZWQpIHtcbiAgYmFja2dyb3VuZDogdmFyKC0tZmlnbWEtY29sb3ItYmctYnJhbmQtaG92ZXIpO1xufVxuXG4uY3JlYXRlLWJ1dHRvbi5kaXNhYmxlZCB7XG4gIG9wYWNpdHk6IDAuNTtcbiAgY3Vyc29yOiBub3QtYWxsb3dlZDtcbiAgcG9pbnRlci1ldmVudHM6IG5vbmU7XG59XG5cbi5mcmFtZXMtbGlzdCB7XG4gIHBhZGRpbmc6IDE2cHg7XG4gIGhlaWdodDogMTAwJTtcbiAgZGlzcGxheTogZmxleDtcbiAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgZ2FwOiA4cHg7XG4gIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICBiYWNrZ3JvdW5kOiB2YXIoLS1maWdtYS1jb2xvci1iZy1zZWNvbmRhcnkpO1xuICBiYWNrZ3JvdW5kLXNpemU6IDE0cHggMTRweDtcbiAgYmFja2dyb3VuZC1pbWFnZTogcmFkaWFsLWdyYWRpZW50KHZhcigtLWZpZ21hLWNvbG9yLWJnLXRlcnRpYXJ5KSAxcHgsIHRyYW5zcGFyZW50IDFweCk7XG59XG5cbi5mcmFtZS1pdGVtIHtcbiAgcGFkZGluZzogNnB4IDhweDtcbiAgYm9yZGVyLXJhZGl1czogMTRweDtcbiAgd2lkdGg6IDEwMCU7XG4gIGJhY2tkcm9wLWZpbHRlcjogYmx1cigxMHB4KTtcbn1cblxuLmZyYW1lLWJsb2NrIHtcbiAgYm9yZGVyLXJhZGl1czogMTBweDtcbiAgd2lkdGg6IDMwcHg7XG4gIGhlaWdodDogMzBweDtcbiAgYmFja2dyb3VuZDogdmFyKC0tZmlnbWEtY29sb3ItYmctc2Vjb25kYXJ5KTtcbn1cblxuLmVtcHR5LXN0YXRlIHtcbiAgY29sb3I6IHZhcigtLWZpZ21hLWNvbG9yLXRleHQtdGVydGlhcnkpO1xuICBmb250LXNpemU6IDExcHg7XG4gIHRleHQtYWxpZ246IGNlbnRlcjtcbiAgbWFyZ2luOiAwIDAgMTJweCAwO1xufVxuXG4ubm90eSB7XG4gIGZsZXg6IDE7XG4gIGRpc3BsYXk6IGZsZXg7XG4gIHdpZHRoOiAxMDAlO1xuICBiYWNrZ3JvdW5kOiB2YXIoLS1maWdtYS1jb2xvci1iZy1kYW5nZXIpO1xuICBjb2xvcjogdmFyKC0tZmlnbWEtY29sb3ItdGV4dC1vbmRhbmdlcik7XG4gIHBhZGRpbmc6IDhweDtcbiAgYm9yZGVyLXJhZGl1czogNnB4O1xuICBmb250LXNpemU6IDExcHg7XG4gIHRleHQtYWxpZ246IGNlbnRlcjtcbiAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG59XG5cbi5jb25uZWN0aW9ucy1saXN0IHtcbiAgZGlzcGxheTogZmxleDtcbiAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgZ2FwOiA0cHg7XG4gIHBhZGRpbmc6IDE2cHg7XG4gIG92ZXJmbG93OiBzY3JvbGw7XG4gIG1hcmdpbi1ib3R0b206IDU2cHg7XG59XG5cbi5jb25uZWN0aW9uLWl0ZW0ge1xuICBkaXNwbGF5OiBmbGV4O1xuICBqdXN0aWZ5LWNvbnRlbnQ6IHNwYWNlLWJldHdlZW47XG4gIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gIHBhZGRpbmc6IDZweCA4cHg7XG4gIGJhY2tncm91bmQ6IHZhcigtLWZpZ21hLWNvbG9yLWJnLXNlY29uZGFyeSk7XG4gIGJvcmRlci1yYWRpdXM6IDhweDtcbn1cblxuLmNvbm5lY3Rpb24tbmFtZSB7XG4gIGZvbnQtc2l6ZTogMTFweDtcbiAgZmxleDogMTtcbiAgd2hpdGUtc3BhY2U6IG5vd3JhcDtcbiAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgdGV4dC1vdmVyZmxvdzogZWxsaXBzaXM7XG4gIG1hcmdpbi1yaWdodDogOHB4O1xufVxuXG4uZGVsZXRlLWJ1dHRvbiB7XG4gIGJhY2tncm91bmQ6IG5vbmU7XG4gIGJvcmRlcjogbm9uZTtcbiAgY29sb3I6IHZhcigtLWZpZ21hLWNvbG9yLXRleHQtc2Vjb25kYXJ5KTtcbiAgY3Vyc29yOiBwb2ludGVyO1xuICBkaXNwbGF5OiBmbGV4O1xuICBhbGlnbi1pdGVtczogY2VudGVyO1xuICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgaGVpZ2h0OiAyMHB4O1xuICB3aWR0aDogMjBweDtcbiAgZm9udC1zaXplOiAxNHB4O1xuICBsaW5lLWhlaWdodDogMTtcbiAgYm9yZGVyLXJhZGl1czogNnB4O1xufVxuXG4uZGVsZXRlLWJ1dHRvbjpob3ZlciB7XG4gIGNvbG9yOiB2YXIoLS1maWdtYS1jb2xvci10ZXh0LW9uZGFuZ2VyKTtcbiAgYmFja2dyb3VuZDogdmFyKC0tZmlnbWEtY29sb3ItYmctZGFuZ2VyKTtcbn1cblxuLmNvbm5lY3Rpb25zIHtcbiAgcG9zaXRpb246IGZpeGVkO1xuICBsZWZ0OiAwO1xuICB0b3A6IDA7XG4gIHotaW5kZXg6IDk5OTtcbiAgYmFja2dyb3VuZDogdmFyKC0tZmlnbWEtY29sb3ItYmcpO1xuICBoZWlnaHQ6IDEwMCU7XG4gIHdpZHRoOiAxMDAlO1xuICBvdmVyZmxvdzogc2Nyb2xsO1xu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 */");
    }

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[9] = list[i];
    	return child_ctx;
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[12] = list[i];
    	return child_ctx;
    }

    // (68:2) {#if errorMessage}
    function create_if_block_5(ctx) {
    	let div;
    	let t;

    	const block = {
    		c: function create() {
    			div = element("div");
    			t = text(/*errorMessage*/ ctx[2]);
    			attr_dev(div, "class", "error-message");
    			add_location(div, file$1, 68, 4, 2133);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*errorMessage*/ 4) set_data_dev(t, /*errorMessage*/ ctx[2]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_5.name,
    		type: "if",
    		source: "(68:2) {#if errorMessage}",
    		ctx
    	});

    	return block;
    }

    // (76:4) {#if showConnections}
    function create_if_block_3(ctx) {
    	let div1;
    	let div0;

    	function select_block_type(ctx, dirty) {
    		if (/*connections*/ ctx[0].length === 0) return create_if_block_4;
    		return create_else_block_3;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			if_block.c();
    			attr_dev(div0, "class", "connections-list svelte-67ony5");
    			add_location(div0, file$1, 77, 4, 2285);
    			attr_dev(div1, "class", "connections svelte-67ony5");
    			add_location(div1, file$1, 76, 2, 2255);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);
    			if_block.m(div0, null);
    		},
    		p: function update(ctx, dirty) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(div0, null);
    				}
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			if_block.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3.name,
    		type: "if",
    		source: "(76:4) {#if showConnections}",
    		ctx
    	});

    	return block;
    }

    // (81:6) {:else}
    function create_else_block_3(ctx) {
    	let each_1_anchor;
    	let each_value_1 = /*connections*/ ctx[0];
    	validate_each_argument(each_value_1);
    	let each_blocks = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	const block = {
    		c: function create() {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(target, anchor);
    				}
    			}

    			insert_dev(target, each_1_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*deleteConnection, connections*/ 1) {
    				each_value_1 = /*connections*/ ctx[0];
    				validate_each_argument(each_value_1);
    				let i;

    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1(ctx, each_value_1, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block_1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value_1.length;
    			}
    		},
    		d: function destroy(detaching) {
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach_dev(each_1_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_3.name,
    		type: "else",
    		source: "(81:6) {:else}",
    		ctx
    	});

    	return block;
    }

    // (79:6) {#if connections.length === 0}
    function create_if_block_4(ctx) {
    	let p;

    	const block = {
    		c: function create() {
    			p = element("p");
    			p.textContent = "No connections yet";
    			attr_dev(p, "class", "empty-state svelte-67ony5");
    			add_location(p, file$1, 79, 8, 2361);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_4.name,
    		type: "if",
    		source: "(79:6) {#if connections.length === 0}",
    		ctx
    	});

    	return block;
    }

    // (82:8) {#each connections as connection}
    function create_each_block_1(ctx) {
    	let div;
    	let span;
    	let t0_value = /*connection*/ ctx[12].name + "";
    	let t0;
    	let t1;
    	let button;
    	let t3;
    	let mounted;
    	let dispose;

    	function click_handler() {
    		return /*click_handler*/ ctx[5](/*connection*/ ctx[12]);
    	}

    	const block = {
    		c: function create() {
    			div = element("div");
    			span = element("span");
    			t0 = text(t0_value);
    			t1 = space();
    			button = element("button");
    			button.textContent = "×";
    			t3 = space();
    			attr_dev(span, "class", "connection-name svelte-67ony5");
    			add_location(span, file$1, 83, 12, 2515);
    			attr_dev(button, "class", "delete-button svelte-67ony5");
    			attr_dev(button, "title", "Delete connection");
    			add_location(button, file$1, 84, 12, 2582);
    			attr_dev(div, "class", "connection-item svelte-67ony5");
    			add_location(div, file$1, 82, 10, 2473);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, span);
    			append_dev(span, t0);
    			append_dev(div, t1);
    			append_dev(div, button);
    			append_dev(div, t3);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", click_handler, false, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty & /*connections*/ 1 && t0_value !== (t0_value = /*connection*/ ctx[12].name + "")) set_data_dev(t0, t0_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_1.name,
    		type: "each",
    		source: "(82:8) {#each connections as connection}",
    		ctx
    	});

    	return block;
    }

    // (102:6) {:else}
    function create_else_block_2(ctx) {
    	let each_1_anchor;
    	let each_value = /*selectedInstances*/ ctx[1];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(target, anchor);
    				}
    			}

    			insert_dev(target, each_1_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*selectedInstances, rgbaToCss*/ 2) {
    				each_value = /*selectedInstances*/ ctx[1];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		i: function intro(local) {
    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}
    		},
    		o: noop,
    		d: function destroy(detaching) {
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach_dev(each_1_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_2.name,
    		type: "else",
    		source: "(102:6) {:else}",
    		ctx
    	});

    	return block;
    }

    // (100:6) {#if selectedInstances.length === 0}
    function create_if_block_2(ctx) {
    	let p;

    	const block = {
    		c: function create() {
    			p = element("p");
    			p.textContent = "Select two cards to connect";
    			attr_dev(p, "class", "empty-state svelte-67ony5");
    			add_location(p, file$1, 100, 8, 2940);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(100:6) {#if selectedInstances.length === 0}",
    		ctx
    	});

    	return block;
    }

    // (103:8) {#each selectedInstances as instance}
    function create_each_block(ctx) {
    	let div1;
    	let div0;
    	let t;
    	let div1_intro;

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			t = space();
    			attr_dev(div0, "class", "frame-block svelte-67ony5");

    			set_style(div0, "background-color", /*instance*/ ctx[9].rgba
    			? rgbaToCss(/*instance*/ ctx[9].rgba, 1)
    			: 'transparent');

    			add_location(div0, file$1, 109, 10, 3410);
    			attr_dev(div1, "class", "frame-item svelte-67ony5");

    			set_style(div1, "background-color", /*instance*/ ctx[9].rgba
    			? rgbaToCss(/*instance*/ ctx[9].rgba, 0.1)
    			: 'transparent');

    			set_style(div1, "border", "1px solid " + (/*instance*/ ctx[9].rgba
    			? rgbaToCss(/*instance*/ ctx[9].rgba, 0.3)
    			: 'var(--figma-color-border)'));

    			add_location(div1, file$1, 103, 10, 3065);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);
    			append_dev(div1, t);
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (dirty & /*selectedInstances*/ 2) {
    				set_style(div0, "background-color", /*instance*/ ctx[9].rgba
    				? rgbaToCss(/*instance*/ ctx[9].rgba, 1)
    				: 'transparent');
    			}

    			if (dirty & /*selectedInstances*/ 2) {
    				set_style(div1, "background-color", /*instance*/ ctx[9].rgba
    				? rgbaToCss(/*instance*/ ctx[9].rgba, 0.1)
    				: 'transparent');
    			}

    			if (dirty & /*selectedInstances*/ 2) {
    				set_style(div1, "border", "1px solid " + (/*instance*/ ctx[9].rgba
    				? rgbaToCss(/*instance*/ ctx[9].rgba, 0.3)
    				: 'var(--figma-color-border)'));
    			}
    		},
    		i: function intro(local) {
    			if (!div1_intro) {
    				add_render_callback(() => {
    					div1_intro = create_in_transition(div1, fly, {
    						y: 30,
    						duration: 200,
    						easing: backOut,
    						delay: 50
    					});

    					div1_intro.start();
    				});
    			}
    		},
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(103:8) {#each selectedInstances as instance}",
    		ctx
    	});

    	return block;
    }

    // (124:4) {:else}
    function create_else_block(ctx) {
    	let div;
    	let button;
    	let iconsettings;
    	let t;
    	let current;
    	let mounted;
    	let dispose;
    	iconsettings = new IconSettings({ $$inline: true });

    	function select_block_type_3(ctx, dirty) {
    		if (/*selectedInstances*/ ctx[1].length >= 3) return create_if_block_1;
    		return create_else_block_1;
    	}

    	let current_block_type = select_block_type_3(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			button = element("button");
    			create_component(iconsettings.$$.fragment);
    			t = space();
    			if_block.c();
    			attr_dev(button, "class", "settings svelte-67ony5");
    			add_location(button, file$1, 125, 6, 3830);
    			attr_dev(div, "class", "button-holder svelte-67ony5");
    			add_location(div, file$1, 124, 4, 3796);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, button);
    			mount_component(iconsettings, button, null);
    			append_dev(div, t);
    			if_block.m(div, null);
    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*click_handler_2*/ ctx[7], false, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (current_block_type === (current_block_type = select_block_type_3(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(div, null);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(iconsettings.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(iconsettings.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_component(iconsettings);
    			if_block.d();
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(124:4) {:else}",
    		ctx
    	});

    	return block;
    }

    // (120:4) {#if showConnections}
    function create_if_block(ctx) {
    	let div;
    	let button;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div = element("div");
    			button = element("button");
    			button.textContent = "Back";
    			attr_dev(button, "class", "create-button svelte-67ony5");
    			add_location(button, file$1, 121, 6, 3684);
    			attr_dev(div, "class", "button-holder svelte-67ony5");
    			add_location(div, file$1, 120, 4, 3650);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, button);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*click_handler_1*/ ctx[6], false, false, false, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(120:4) {#if showConnections}",
    		ctx
    	});

    	return block;
    }

    // (133:6) {:else}
    function create_else_block_1(ctx) {
    	let button;
    	let t;
    	let button_disabled_value;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			button = element("button");
    			t = text("Connect");
    			attr_dev(button, "class", "create-button svelte-67ony5");
    			button.disabled = button_disabled_value = /*selectedInstances*/ ctx[1].length !== 2;
    			toggle_class(button, "disabled", /*selectedInstances*/ ctx[1].length !== 2);
    			add_location(button, file$1, 133, 6, 4060);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);
    			append_dev(button, t);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*createConnection*/ ctx[4], false, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*selectedInstances*/ 2 && button_disabled_value !== (button_disabled_value = /*selectedInstances*/ ctx[1].length !== 2)) {
    				prop_dev(button, "disabled", button_disabled_value);
    			}

    			if (dirty & /*selectedInstances*/ 2) {
    				toggle_class(button, "disabled", /*selectedInstances*/ ctx[1].length !== 2);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_1.name,
    		type: "else",
    		source: "(133:6) {:else}",
    		ctx
    	});

    	return block;
    }

    // (129:6) {#if selectedInstances.length >= 3}
    function create_if_block_1(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element("div");
    			div.textContent = "Two cards only";
    			attr_dev(div, "class", "noty svelte-67ony5");
    			add_location(div, file$1, 129, 6, 3985);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(129:6) {#if selectedInstances.length >= 3}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let div2;
    	let t0;
    	let div1;
    	let t1;
    	let div0;
    	let t2;
    	let current_block_type_index;
    	let if_block3;
    	let current;
    	let if_block0 = /*errorMessage*/ ctx[2] && create_if_block_5(ctx);
    	let if_block1 = /*showConnections*/ ctx[3] && create_if_block_3(ctx);

    	function select_block_type_1(ctx, dirty) {
    		if (/*selectedInstances*/ ctx[1].length === 0) return create_if_block_2;
    		return create_else_block_2;
    	}

    	let current_block_type = select_block_type_1(ctx);
    	let if_block2 = current_block_type(ctx);
    	const if_block_creators = [create_if_block, create_else_block];
    	const if_blocks = [];

    	function select_block_type_2(ctx, dirty) {
    		if (/*showConnections*/ ctx[3]) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type_2(ctx);
    	if_block3 = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			if (if_block0) if_block0.c();
    			t0 = space();
    			div1 = element("div");
    			if (if_block1) if_block1.c();
    			t1 = space();
    			div0 = element("div");
    			if_block2.c();
    			t2 = space();
    			if_block3.c();
    			attr_dev(div0, "class", "frames-list svelte-67ony5");
    			add_location(div0, file$1, 98, 4, 2863);
    			attr_dev(div1, "class", "section");
    			add_location(div1, file$1, 73, 2, 2204);
    			attr_dev(div2, "class", "plugin-container svelte-67ony5");
    			add_location(div2, file$1, 66, 0, 2077);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			if (if_block0) if_block0.m(div2, null);
    			append_dev(div2, t0);
    			append_dev(div2, div1);
    			if (if_block1) if_block1.m(div1, null);
    			append_dev(div1, t1);
    			append_dev(div1, div0);
    			if_block2.m(div0, null);
    			append_dev(div1, t2);
    			if_blocks[current_block_type_index].m(div1, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*errorMessage*/ ctx[2]) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    				} else {
    					if_block0 = create_if_block_5(ctx);
    					if_block0.c();
    					if_block0.m(div2, t0);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (/*showConnections*/ ctx[3]) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block_3(ctx);
    					if_block1.c();
    					if_block1.m(div1, t1);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (current_block_type === (current_block_type = select_block_type_1(ctx)) && if_block2) {
    				if_block2.p(ctx, dirty);
    			} else {
    				if_block2.d(1);
    				if_block2 = current_block_type(ctx);

    				if (if_block2) {
    					if_block2.c();
    					transition_in(if_block2, 1);
    					if_block2.m(div0, null);
    				}
    			}

    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type_2(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block3 = if_blocks[current_block_type_index];

    				if (!if_block3) {
    					if_block3 = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block3.c();
    				} else {
    					if_block3.p(ctx, dirty);
    				}

    				transition_in(if_block3, 1);
    				if_block3.m(div1, null);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block2);
    			transition_in(if_block3);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block3);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			if_block2.d();
    			if_blocks[current_block_type_index].d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function rgbaToCss(rgba, overrideAlpha) {
    	const r = Math.round(rgba.r * 255);
    	const g = Math.round(rgba.g * 255);
    	const b = Math.round(rgba.b * 255);
    	const a = overrideAlpha !== undefined ? overrideAlpha : rgba.a;
    	return `rgba(${r}, ${g}, ${b}, ${a})`;
    }

    function deleteConnection(name) {
    	parent.postMessage(
    		{
    			pluginMessage: {
    				type: 'DELETE_CONNECTION',
    				connectionName: name
    			}
    		},
    		'*'
    	);
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('PluginUI', slots, []);
    	let connections = [];
    	let selectedInstances = [];
    	let errorMessage = null;

    	// Handle messages from Figma
    	onMount(() => {
    		window.onmessage = event => {
    			const msg = event.data.pluginMessage;

    			// console.log('Received message:', msg.type);
    			switch (msg.type) {
    				case 'CONNECTIONS_UPDATED':
    					// console.log('Connections updated:', msg.connections);
    					$$invalidate(0, connections = msg.connections);
    					break;
    				case 'INSTANCES_SELECTED':
    					console.log('Instances selected:', msg.instances);
    					$$invalidate(1, selectedInstances = msg.instances);
    					break;
    				case 'ERROR':
    					showError(msg.message);
    					break;
    			}
    		};
    	});

    	function showError(message) {
    		$$invalidate(2, errorMessage = message);

    		setTimeout(
    			() => {
    				$$invalidate(2, errorMessage = null);
    			},
    			3000
    		);
    	}

    	function createConnection() {
    		if (selectedInstances.length !== 2) {
    			showError('Select exactly two instances to connect');
    			return;
    		}

    		const message = {
    			type: 'CREATE_CONNECTION',
    			sourceId: selectedInstances[0].id,
    			targetId: selectedInstances[1].id
    		};

    		parent.postMessage({ pluginMessage: message }, '*');
    	}

    	let showConnections = false;
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1.warn(`<PluginUI> was created with unknown prop '${key}'`);
    	});

    	const click_handler = connection => deleteConnection(connection.name);
    	const click_handler_1 = () => $$invalidate(3, showConnections = false);
    	const click_handler_2 = () => $$invalidate(3, showConnections = true);

    	$$self.$capture_state = () => ({
    		fly,
    		backOut,
    		onMount,
    		IconSettings,
    		connections,
    		selectedInstances,
    		errorMessage,
    		rgbaToCss,
    		showError,
    		createConnection,
    		deleteConnection,
    		showConnections
    	});

    	$$self.$inject_state = $$props => {
    		if ('connections' in $$props) $$invalidate(0, connections = $$props.connections);
    		if ('selectedInstances' in $$props) $$invalidate(1, selectedInstances = $$props.selectedInstances);
    		if ('errorMessage' in $$props) $$invalidate(2, errorMessage = $$props.errorMessage);
    		if ('showConnections' in $$props) $$invalidate(3, showConnections = $$props.showConnections);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		connections,
    		selectedInstances,
    		errorMessage,
    		showConnections,
    		createConnection,
    		click_handler,
    		click_handler_1,
    		click_handler_2
    	];
    }

    class PluginUI extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {}, add_css);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "PluginUI",
    			options,
    			id: create_fragment$1.name
    		});
    	}
    }

    const app = new PluginUI({
    	target: document.body,
    });

    return app;

}());

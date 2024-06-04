const px = (n) => (n ? `${n}px` : '0');
const randomFloat = (max, min = 0) => min + Math.random() * (max - min);
const randomInt = (max, min = 0) => Math.floor(randomFloat(max, min));
const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
const distSquared = (a, b) => {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
};

class MouseListener {
    /**
     * @type {MouseListener | undefined}
     */
    static instance = undefined;
    static listen() {
        if (!MouseListener.instance) {
            MouseListener.instance = new MouseListener();
        }
        return MouseListener.instance;
    }

    constructor() {
        this.x = 0;
        this.y = 0;

        document.addEventListener('mousemove', (e) => {
            this.x = e.pageX;
            this.y = e.pageY;
        });
    }
}

/**
 * @template Value
 */
class RandomPool {
    #weights = [];
    #values = [];
    #total = 0;

    /**
     * @param {[Value, number][]} pool
     */
    constructor(pool) {
        this.#values = pool.map((p) => p[0]);
        this.#weights = pool.map((p) => p[1]);
        this.#total = this.#weights.reduce((total, w) => total + w, 0);
    }

    /**
     * @returns {Value}
     */
    pull() {
        const rand = randomFloat(this.#total);
        let walkingSum = 0;

        return this.#values.find((_, index) => {
            walkingSum += this.#weights[index];
            return rand < walkingSum;
        });
    }
}

/**
 * @template Data
 */
class State {
    #handle;
    #elapsed;

    /**
     * @callback Handler
     * @param {State<Data> & Data} state
     */
    /**
     * @callback UpdateHandler
     * @param {State<Data> & Data} state
     * @param {number} dt
     */
    /**
     * @param {{data: Data, enter: Handler, exit: Handler, update: UpdateHandler}} state
     */
    constructor({ data, enter, update, exit }) {
        Object.assign(this, data ?? {});
        this.onEnter = enter;
        this.onUpdate = update;
        this.onExit = exit;
    }

    enter() {
        this.#elapsed = 0;
        this.onEnter?.(this);
    }
    update(dt) {
        this.#elapsed += dt;
        this.onUpdate?.(this, dt);
    }
    exit() {
        this.clearTimeout();
        this.onExit?.(this);
    }

    every(seconds) {
        if (this.#elapsed >= seconds) {
            this.#elapsed = 0;
            return true;
        }

        return false;
    }

    clearTimeout() {
        if (this.#handle) {
            clearTimeout(this.#handle);
            this.#handle = undefined;
        }
    }

    setTimeout(handler, timeoutSeconds, ...args) {
        this.clearTimeout();
        this.#handle = setTimeout(handler, timeoutSeconds * 1000, ...args);
    }
}

const defaultOptions = {
    debug: false,

    width: 32,
    height: 32,
    speed: 250,

    mouseProximity: 48,
    jitter: 32,

    updatesPerSecond: 60,

    sprite: 'duck.png',
    spriteCols: 4,
    spriteScale: 1,

    /**
     * @type {HTMLElement}
     */
    container: document.querySelector('body'),
};
class Duck {
    options = defaultOptions;
    id = crypto.randomUUID();

    #style = document.createElement('style');
    #duck = document.createElement('div');

    #currentState = 'idle';
    #lastTimestamp = document.timeline.currentTime;

    #frames = [];
    #frameTimes = [];
    #currentFrameIndex = 0;
    #currentFrameTime = 0;

    #states = {
        idle: new State({
            data: {
                transitionPool: new RandomPool([
                    ['sleeping', 25],
                    ['quack', 35],
                    ['walking', 5],
                    [undefined, 35],
                ]),
            },
            enter: () => {
                this.#frames = [0, 1];
                this.#frameTimes = [2, 0.1];
            },
            update: (state) => {
                if (this.#isCloseToMouse()) {
                    if (state.every(5)) {
                        const target = state.transitionPool.pull();
                        if (target) {
                            this.#changeState(target);
                        }
                    }
                } else {
                    this.#changeState('alert');
                }
            },
        }),
        alert: new State({
            enter: (state) => {
                this.#frames = [1];
                this.#frameTimes = [1];
                state.setTimeout(() => this.#changeState('walking'), 1);
            },
            update: () => {
                if (this.#isCloseToMouse()) {
                    this.#changeState('idle');
                }
            },
        }),
        sleeping: new State({
            data: {
                transitionPool: new RandomPool([
                    ['idle', 60],
                    [undefined, 40],
                ]),
            },
            enter: () => {
                this.#frames = [8, 9, 10, 11];
                this.#frameTimes = [0.5, 0.5, 0.5, 0.5];
            },
            update: (state) => {
                if (this.#isCloseToMouse()) {
                    if (state.every(5)) {
                        const target = state.transitionPool.pull();
                        if (target) {
                            this.#changeState(target);
                        }
                    }
                } else {
                    this.#changeState('idle');
                }
            },
        }),
        quack: new State({
            enter: (state) => {
                this.#frames = [12, 13, 14];
                this.#frameTimes = [0.1, 0.2, 0.2];
                state.setTimeout(() => this.#changeState('idle'), 0.5);
            },
        }),
        walking: new State({
            enter: (state) => {
                const { jitter } = this.options;
                state.jitter = {
                    x: randomInt(-jitter, jitter),
                    y: randomInt(-jitter, jitter),
                };
                this.#frames = [4, 5, 6, 7];
                this.#frameTimes = [0.05, 0.05, 0.05, 0.05];
            },
            update: (state, dt) => {
                if (this.#isCloseToMouse()) {
                    this.#changeState('idle');
                } else {
                    const { speed } = this.options;
                    this.#moveTowards(add(this.mouse, state.jitter), speed * dt);
                }
            },
        }),
    };

    constructor(options = defaultOptions) {
        this.options = { ...defaultOptions, ...options };

        const { width, height, container, sprite, spriteCols, spriteScale } = this.options;

        this.#style.dataset.duckId = this.id;
        this.#style.textContent = `div[data-duck-id="${this.id}"] {
            position: absolute;
            width: ${px(spriteScale * width)};
            height: ${px(spriteScale * height)};
            background-image: url('${sprite}');
            background-size: ${px(spriteScale * spriteCols * width)} ${px(spriteScale * spriteCols * width)};
            pointer-events: none;
            image-rendering: pixelated;
        }`;

        this.#duck.ariaHidden = true;
        this.#duck.dataset.duckId = this.id;
        this.#move(randomInt(container.clientWidth), randomInt(container.clientHeight));
    }

    quack() {
        const { container } = this.options;
        this.lastQuack = false;
        document.head.appendChild(this.#style);
        container.appendChild(this.#duck);
        this.mouse = MouseListener.listen();
        this.#lastTimestamp = document.timeline.currentTime;
        this.#changeState('idle');
        requestAnimationFrame((t) => this.#update(t));

        return this;
    }

    bye() {
        this.lastQuack = true;
        this.#style.remove();
        this.#duck.remove();
    }

    #update(timestamp) {
        const { updatesPerSecond } = this.options;

        const elapsed = timestamp - this.#lastTimestamp;
        if (elapsed >= 1000 / updatesPerSecond) {
            this.#lastTimestamp = timestamp;
            const dt = elapsed / 1000;
            this.#states[this.#currentState].update(dt);
            this.#animate(dt);
        }

        if (!this.lastQuack) {
            requestAnimationFrame((t) => this.#update(t));
        }
    }

    #updateSprite() {
        const { width, height, spriteCols, spriteScale } = this.options;
        const frame = this.#frames[this.#currentFrameIndex];
        const col = frame % spriteCols;
        const row = Math.floor(frame / spriteCols);

        this.#duck.style.backgroundPositionX = px(-col * width * spriteScale);
        this.#duck.style.backgroundPositionY = px(-row * height * spriteScale);
    }

    #animate(dt) {
        if (this.#currentFrameTime > this.#frameTimes[this.#currentFrameIndex]) {
            this.#currentFrameIndex = (this.#currentFrameIndex + 1) % this.#frames.length;
            this.#currentFrameTime = 0;

            this.#updateSprite();
        } else {
            this.#currentFrameTime += dt;
        }
    }

    /**
     * @param {keyof(Duck['#states'])} stateName
     */
    #changeState(stateName) {
        this.#states[this.#currentState].exit();
        this.#states[stateName].enter();

        this.#currentFrameIndex = 0;
        this.#currentFrameTime = 0;
        this.#updateSprite();

        this.#currentState = stateName;
    }

    #moveTowards(dest, max) {
        let dx = dest.x - this.x;
        let dy = dest.y - this.y;

        let distSquared = dx * dx + dy * dy;
        if (distSquared <= max * max) {
            this.#move(dest.x, dest.y);
        } else {
            const d = Math.max(Math.abs(dx), Math.abs(dy));
            dx = (dx / d) * max;
            dy = (dy / d) * max;

            this.#move(this.x + dx, this.y + dy);
        }
    }

    #move(x, y) {
        const { width, height, container } = this.options;
        const halfW = width / 2;
        const halfH = height / 2;
        this.x = clamp(x, halfW, container.clientWidth - halfW);
        this.y = clamp(y, halfH, container.clientHeight - halfH);
        this.#duck.style.left = px(Math.ceil(this.x - halfW));
        this.#duck.style.top = px(Math.ceil(this.y - halfH));
        this.#duck.style.zIndex = `${1_000_000 + Math.ceil(this.y)}`;
    }

    #isCloseToMouse() {
        const { mouseProximity, width, height, spriteScale } = this.options;
        const proximity = mouseProximity + spriteScale * Math.max(width / 2, height / 2);
        return distSquared(this, this.mouse) <= proximity * proximity;
    }
}

(function quackJs() {
    const scriptConfig = Object.fromEntries(
        Object.entries(document.currentScript.dataset).map((e) => {
            const [key, value] = e;

            if (['sprite', 'spawn'].includes(key)) {
                return e;
            } else if ([].includes(key)) {
                return [key, JSON.parse(value)];
            } else if ([].includes(key)) {
                return [key, value.split(',')];
            } else if (['container'].includes(key)) {
                return [key, document.querySelector(value)];
            }

            const parsed = Number.parseFloat(value);
            if (Number.isNaN(parsed)) {
                return e;
            }

            return [key, parsed];
        })
    );

    if (scriptConfig.spawn !== 'false') {
        new Duck(scriptConfig).quack();
    }

    if ('click' in scriptConfig) {
        document.addEventListener('click', () => {
            const duck = new Duck(scriptConfig).quack();
            const delay = scriptConfig.click ?? 5;
            if (delay > 0) {
                setTimeout(() => duck.bye(), delay * 1000);
            }
        });
    }
})();

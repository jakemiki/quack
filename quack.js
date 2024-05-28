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

const distSquared = (a, b) => {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
};
const px = (n) => (n ? `${n}px` : '0');
const randomInt = (max, min = 0) => Math.floor(min + Math.random() * (max - min));
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });

const scriptConfig = { ...document.currentScript.dataset };
const defaultOptions = {
    debug: false,

    width: 32,
    height: 32,
    jitter: 96,
    speed: 250,
    mouseProximity: 40,
    fps: 60,
    sprite: 'duck.png',

    /**
     * @type {HTMLElement}
     */
    container: document.querySelector('html'),
    ...scriptConfig,
};
class Duck {
    options = defaultOptions;
    id = crypto.randomUUID();

    #style = document.createElement('style');
    #duck = document.createElement('div');
    #timer = 0;
    #handle = 0;
    #jitter = { x: 0, y: 0 };
    #currentState = 'idle';
    #lastTimestamp = document.timeline.currentTime;
    #frames = [];
    #frameTimes = [];
    #currentFrameIndex = 0;
    #currentFrameTime = 0;
    #states = {
        idle: {
            enter: () => {
                this.#frames = [0, 1];
                this.#frameTimes = [2, 0.1];
                this.#currentFrameIndex = 0;
                this.#currentFrameTime = Number.MAX_VALUE;
                this.#timer = 0;
            },
            update: () => {
                if (this.#isCloseToMouse()) {
                    if (this.#timer > 5) {
                        this.#timer = 0;
                        const rand = Math.random();
                        if (rand < 0.25) {
                            this.#changeState('sleeping');
                        } else if (rand < 0.6) {
                            this.#changeState('quack');
                        }
                    }
                } else {
                    this.#changeState('alert');
                }
            },
        },
        alert: {
            enter: () => {
                this.#frames = [1];
                this.#frameTimes = [1];
                this.#currentFrameIndex = 0;
                this.#currentFrameTime = Number.MAX_VALUE;
            },
            update: () => {
                if (this.#isCloseToMouse()) {
                    this.#changeState('idle');
                } else {
                    if (!this.#handle) {
                        this.#handle = setTimeout(() => this.#changeState('walking'), 1000);
                    }
                }
            },
            exit: () => {
                if (this.#handle) {
                    clearTimeout(this.#handle);
                    this.#handle = 0;
                }
            },
        },
        sleeping: {
            enter: () => {
                this.#timer = 0;
                this.#frames = [8, 9, 10, 11];
                this.#frameTimes = [0.5, 0.5, 0.5, 0.5];
                this.#currentFrameIndex = 0;
                this.#currentFrameTime = Number.MAX_VALUE;
            },
            update: () => {
                if (this.#isCloseToMouse()) {
                    if (this.#timer > 5) {
                        this.#timer = 0;
                        const rand = Math.random();
                        if (rand < 0.6) {
                            this.#changeState('idle');
                        }
                    }
                } else {
                    this.#changeState('idle');
                }
            },
        },
        quack: {
            enter: () => {
                this.#frames = [12, 13, 14];
                this.#frameTimes = [0.1, 0.2, 0.2];
                this.#currentFrameIndex = 0;
                this.#currentFrameTime = Number.MAX_VALUE;
            },
            update: () => {
                if (!this.#handle) {
                    this.#handle = setTimeout(() => this.#changeState('idle'), 500);
                }
            },
            exit: () => {
                if (this.#handle) {
                    clearTimeout(this.#handle);
                    this.#handle = 0;
                }
            },
        },
        walking: {
            enter: () => {
                const { jitter } = this.options;
                this.#jitter = {
                    x: randomInt(-jitter, jitter),
                    y: randomInt(-jitter, jitter),
                };
                this.#frames = [4, 5, 6, 7];
                this.#frameTimes = [0.05, 0.05, 0.05, 0.05];
                this.#currentFrameIndex = 0;
                this.#currentFrameTime = Number.MAX_VALUE;
            },
            update: (dt) => {
                if (this.#isCloseToMouse()) {
                    this.#changeState('idle');
                } else {
                    const { speed } = this.options;
                    this.#moveTowards(add(this.mouse, this.#jitter), speed * dt);
                }
            },
        },
    };

    constructor(options = defaultOptions) {
        this.options = { ...defaultOptions, ...options };

        const { width, height, container, sprite } = this.options;

        this.#style.dataset.duckId = this.id;
        this.#style.textContent = `div[data-duck-id="${this.id}"] {
            position: absolute;
            width: ${px(width)};
            height: ${px(height)};
            background-image: url('${sprite}');
            pointer-events: none;
            z-index: ${Number.MAX_SAFE_INTEGER};
            image-rendering: pixelated;
        }`;

        this.#duck.ariaHidden = true;
        this.#duck.dataset.duckId = this.id;
        this.#move(randomInt(container.clientWidth), randomInt(container.clientHeight));
        this.#changeState('idle');
    }

    quack() {
        document.head.appendChild(this.#style);
        document.body.appendChild(this.#duck);
        this.mouse = MouseListener.listen();
        this.#lastTimestamp = document.timeline.currentTime;
        window.requestAnimationFrame((t) => this.#update(t));

        return this;
    }

    bye() {
        this.lastQuack = true;
        this.#style.remove();
        this.#duck.remove();
    }

    #update(timestamp) {
        const { fps } = this.options;

        const elapsed = timestamp - this.#lastTimestamp;
        if (elapsed >= 1000 / fps) {
            this.#lastTimestamp = timestamp;
            const dt = elapsed / 1000;
            this.#timer += dt;
            this.#states[this.#currentState].update?.(dt);
            this.#animate(dt);
        }

        if (!this.lastQuack) {
            window.requestAnimationFrame((t) => this.#update(t));
        }
    }

    #animate(dt) {
        if (this.#currentFrameTime > this.#frameTimes[this.#currentFrameIndex]) {
            this.#currentFrameIndex = (this.#currentFrameIndex + 1) % this.#frames.length;
            this.#currentFrameTime = 0;

            const frame = this.#frames[this.#currentFrameIndex];
            const col = frame % 4;
            const row = Math.floor(frame / 4);

            const { width, height } = this.options;
            this.#duck.style.backgroundPositionX = px(-col * width);
            this.#duck.style.backgroundPositionY = px(-row * height);
        } else {
            this.#currentFrameTime += dt;
        }
    }

    /**
     * @param {keyof(Duck['#states'])} stateName
     */
    #changeState(stateName) {
        this.#states[this.#currentState].exit?.();
        this.#states[stateName].enter?.();
        'debug' in this.options && console.log(`${this.#currentState}\t->\t${stateName}`);
        this.#currentState = stateName;
    }

    #moveTowards(dest, max) {
        let dx = dest.x - this.x;
        let dy = dest.y - this.y;

        const d = Math.max(Math.abs(dx), Math.abs(dy));
        dx = (dx / d) * max;
        dy = (dy / d) * max;

        this.#move(this.x + dx, this.y + dy);
    }

    #move(x, y) {
        const { width, height, container } = this.options;
        const halfW = width / 2;
        const halfH = height / 2;
        this.x = Math.max(halfW, Math.min(x, container.clientWidth - halfW));
        this.y = Math.max(halfH, Math.min(y, container.clientHeight - halfH));
        this.#duck.style.left = px(Math.ceil(this.x - halfW));
        this.#duck.style.top = px(Math.ceil(this.y - halfH));
    }

    #isCloseToMouse() {
        const { mouseProximity } = this.options;
        return distSquared(this, add(this.mouse, this.#jitter)) <= mouseProximity * mouseProximity;
    }
}

(function quackJs() {
    if (scriptConfig.spawn !== 'false') {
        new Duck().quack();
    }

    if ('click' in scriptConfig) {
        document.addEventListener('click', () => {
            const duck = new Duck().quack();
            const delay = Number.parseInt(scriptConfig.click) ?? 5000;
            if (delay > 0) {
                setTimeout(() => duck.bye(), delay);
            }
        });
    }
})();

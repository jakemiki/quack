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
    jitter = { x: 0, y: 0 };
    currentState = 'idle';
    lastTimestamp = document.timeline.currentTime;
    states = {
        idle: {
            enter: () => {
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
                this.jitter = {
                    x: randomInt(-jitter, jitter),
                    y: randomInt(-jitter, jitter),
                };
            },
            update: (dt) => {
                if (this.#isCloseToMouse()) {
                    this.#changeState('idle');
                } else {
                    const { speed } = this.options;
                    this.#moveTowards(add(this.mouse, this.jitter), speed * dt);
                }
            },
        },
    };

    constructor(options = defaultOptions) {
        this.options = { ...defaultOptions, ...options };

        const { width, height, container } = this.options;

        this.#style.dataset.duckId = this.id;
        this.#style.textContent = `div[data-duck-id="${this.id}"] {
            position: absolute;
            width: ${px(width)};
            height: ${px(height)};
            background-color: rgb(128, 0, 128);
            pointer-events: none;
            z-index: ${Number.MAX_VALUE};
            image-rendering: pixelated;
        }`;

        this.#duck.ariaHidden = true;
        this.#duck.dataset.duckId = this.id;
        this.#move(randomInt(container.clientWidth), randomInt(container.clientHeight));
    }

    quack() {
        document.head.appendChild(this.#style);
        document.body.appendChild(this.#duck);
        this.mouse = MouseListener.listen();
        this.lastTimestamp = document.timeline.currentTime;
        window.requestAnimationFrame((t) => this.#update(t));

        return this;
    }

    bye() {
        this.lastQuack = true;
        this.#style.remove();
        this.#duck.remove();
    }

    #update(timestamp) {
        if ('debug' in this.options) {
            this.#duck.textContent = this.currentState;
        }

        const { fps } = this.options;

        const elapsed = timestamp - this.lastTimestamp;
        if (elapsed >= 1000 / fps) {
            this.lastTimestamp = timestamp;
            const dt = elapsed / 1000;
            this.#timer += dt;
            this.states[this.currentState].update?.(dt);
        }

        if (!this.lastQuack) {
            window.requestAnimationFrame((t) => this.#update(t));
        }
    }

    /**
     * @param {keyof(Duck['states'])} stateName
     */
    #changeState(stateName) {
        this.states[this.currentState].exit?.();
        this.states[stateName].enter?.();
        'debug' in this.options && console.log(`${this.currentState}\t->\t${stateName}`);
        this.currentState = stateName;
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
        return distSquared(this, add(this.mouse, this.jitter)) <= mouseProximity * mouseProximity;
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

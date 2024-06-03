# quack.js

a pet duck for my personal [website](https://jakemiki.me/).

## Demo

You can see the duck in action either at [jakemiki.me](https://jakemiki.me) or [this github page](https://jakemiki.github.io/quack/).

## Adopt a duck

Copy `quack.js` and `duck.png` to your website and load it in your html

```html
<script src="quack.js"></script>
```

That's all you need to bring the duck to your page.

If you don't want the duck to spawn on page load you can you can set it up on the script element

```html
<script src="quack.js" data-spawn="false"></script>
```

If you want more ducks to appear on click use `data-click` where the value is time in seconds before the duck disappears (`0` for infinite ducks)

```html
<script src="quack.js" data-click="10"></script>
```

### Scripting API

To have a little bit more control over your duck there is a simple scripting API

```js
const options = { 
    // ...
};
const duck = new Duck(options);

// show the duck
duck.quack();

// hide the duck
duck.bye();
```

## Options

The duck can be configured with options provided directly to the constructor

```js
const defaultOptions = {
    width: 32,
    height: 32,
    speed: 250,

    mouseProximity: 48,
    jitter: 32,

    updatesPerSecond: 60,

    sprite: 'duck.png',
    spriteCols: 4,
    spriteScale: 1,

    container: document.querySelector('html'),
};
```

or when used without custom scripting through dataset of the script element

```html
<script src="quack.js" 
        data-sprite="duck.png"
        data-sprite-scale="2"
        data-container="#duck-pen">
</script>
```

## FAQ

It's a duck.

No, it's not a pigeon.

No, it's not a seagull.

Just a duck, drawn by a software engineer.

## Figmasset

Figmasset is a tool to facilitate bulk-loading assets from Figma into a JavaScript application. This makes it easy to load the latest version of assets under active development, including map marker icons, mockup UI overlays, legend images etc. Which means designers can iterate on assets, without needing developers to keep saving the latest copy of assets and redeploying.

Figmasset supports loading assets from several different frames in the same file. Assets loaded later will override earlier assets if they share a name.

This has two main uses:

1. Loading different groups of assets worked on by different people
2. Loading a "base" set of icons and an "override" set, so you can iterate on designs of a few icons without having to duplicate all the base icons.


Figmasset can be used in Node by importing the `node-fetch` library and passing it as the `fetchFunc` parameter.

**Note**: This library is still in early days and its interface is not stable.

### Setting up your assets in Figma

In Figma, arrange your assets as top-level children under one or more frames. That is, your Layers sidebar should look something like this:

```
# myframe
  # mycircle
  # myrectangle
# myotherframe
  # myexclamation
    - dot
    - straight bit
# other frame I don't care about
  # junk
```

Get the file key from the URL. Given a URL like https://www.figma.com/file/ABC123/Untitled?node-id=0%3A1, "ABC123" is your file key.

### Loading your assets

```js
import { getFigmaIconsByFrames } from 'figmasset';

async function loadAssets() {
    return getFigmaIconsByFrames({
        // frameIds = [], // you can specify frames by their node ID (in the URL)
        frameNames = ['myframe', 'myotherframe'],
        fileKey: 'ABC123',
        personalAccessToken: 'snt34h5sn24h5', // get this from your user > Settings page. Be careful who you expose this to, it provides unrestricted access to your account
        scales: [1, 2], // pixel ratios. [1,2] fetches both @1x and @2x versions of each asset.
        // format: 'png', // svg is also supported
        // fetchFunc: window.fetch, // in the browser, fetch is used. If using in Node, pass in the node-fetch library.
    });
}
```

The Figma API can take a few seconds to generate PNG versions of assets. Once it returns, you will have an object of this form:

```js
{
  'mycircle': {
    id: '2:8', // the node ID
    '@1x': 'https://s3-us-west-2.amazonaws.com/figma-alpha-api/img/5b83/a061/e42384a5bc5a5ac5cabcb5a5cabcb5c5,
    '@2x': 'https://s3-us-west-2.amazonaws.com/figma-alpha-api/img/af20/18b77f7fe7ee57f5efe5ef5ee7eaa2f32aea0'
  },
  ...
}
```

### Loading assets into Mapbox GL JS or Maplibre GL JS

To load the assets as icons, you can use this snippet:

```js
const assets = loadAssets(); // defined above
for (const iconId of Object.keys(assets)) {
    map.loadImage(assets[iconId]['@2x'], (error, image) => {
        this.map.addImage(asset.id, image, {
            pixelRatio: asset.scale
        })
    });
}
```

or, if you are using map-gl-utils:

```js
for (const iconId of Object.keys(assets)) {
    map.U.loadImage(iconId, assets[iconId]['@2x'], {
        pixelRatio: asset.scale,
    });
}
```
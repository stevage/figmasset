class figmaApi {
    _personalAccessToken;
    _fetchFunc;
    constructor({ personalAccessToken, fetchFunc }) {
        this._personalAccessToken = personalAccessToken;
        this._fetchFunc = fetchFunc;
    }
    async get(api, params) {
        const search = params
            ? '?' + new URLSearchParams(params).toString()
            : '';
        const response = await this._fetchFunc(
            `https://api.figma.com/v1/${api}${search}`,
            {
                headers: { 'X-Figma-Token': this._personalAccessToken },
            }
        );
        if (response.status >= 400) {
            let extra = '';
            try {
                extra += (await response.json()).err;
            } finally {
                throw new Error(
                    `HTTP error ${response.status} accessing Figma. ${extra}`
                );
            }
        }
        return response.json();
    }
}

// For each nodeId, find its corresponding node by searching the document.
// Note this is pretty inefficient, we can end up traversing the entire document quite a few times. Likely insignificant on smallish documents.
function findNodesById({ file, nodeIds }) {
    function findNode(nodeId, searchNode) {
        if (nodeId === searchNode.id) {
            return searchNode;
        } else if (searchNode.children) {
            return searchNode.children
                .map((n) => findNode(nodeId, n))
                .find(Boolean);
        } else {
            return null;
        }
    }
    return nodeIds.map((nodeId) => findNode(nodeId, file.document));
}

function findNodeIdsForNames({ file, names }) {
    // find node IDs for names with a depth-first search
    function findNameInNode(name, node) {
        if (name === node.name && node.type === 'FRAME') {
            return node.id;
        } else if (node.children) {
            return node.children
                .map((n) => findNameInNode(name, n))
                .find(Boolean);
        } else {
            return null;
        }
    }

    return names.map((name) => findNameInNode(name, file.document));
}

/* Request images for some assets, and combine multiple scales into one object per asset */
async function getAssetImages(api, fileKey, assetList, scales = [1]) {
    async function getImageList(scale) {
        return api.get(`images/${fileKey}`, {
            ids: Object.values(assetList),
            format: 'png',
            scale,
        });
    }

    const assetsWithUrls = {};
    const imageLists = await Promise.all(
        scales.map((scale) => getImageList(scale))
    );
    scales.forEach((scale, scaleIndex) => {
        for (const name of Object.keys(assetList)) {
            const nodeId = assetList[name];
            assetsWithUrls[name] = assetsWithUrls[name] || { id: nodeId };
            assetsWithUrls[name][`@${scale}x`] =
                imageLists[scaleIndex].images[nodeId];
        }
    });
    return assetsWithUrls;
}

// Given a number of frames, compiles a set of named top-level nodes within them. Later nodes of the same name replace earlier ones.
function makeAssetList(frames) {
    const assetList = {};
    for (const frame of frames.filter(Boolean)) {
        for (const node of frame.children) {
            assetList[node.name] = node.id;
        }
    }
    return assetList;
}

/*
Returns URLs of rasterisations of all objects within one or more frames specified by ID or name, for one or more scales.
Return format:
{
  'asset-name': {
    id: '102:5',
    '@1x': 'https://s3-us-west-2.amazonaws
    '@2x': '...'
  },
  ...
}
*/
async function getFigmaIconsByFrames({
    frameIds = [],
    frameNames = [],
    fileKey,
    personalAccessToken,
    scales = [1],
    fetchFunc = window.fetch,
}) {
    const api = new figmaApi({ personalAccessToken, fetchFunc });
    const file = await api.get(`files/${fileKey}`);
    if (frameNames.length) {
        frameIds = [
            ...frameIds,
            ...findNodeIdsForNames({ file, names: frameNames }),
        ];
    }
    const frames = findNodesById({ file, nodeIds: frameIds }).filter(Boolean);
    if (!frames.length) {
        throw new Error(`No matching frames for ${frameIds}, ${frameNames}`);
    }

    const assetList = makeAssetList(frames);

    return await getAssetImages(api, fileKey, assetList, scales);
}

module.exports = { getFigmaIconsByFrames };

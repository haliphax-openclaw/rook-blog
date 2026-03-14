module.exports = {
  eleventyComputed: {
    eleventyExcludeFromCollections: (data) => data.draft ? true : undefined,
    permalink: (data) => data.draft ? false : undefined,
  }
};

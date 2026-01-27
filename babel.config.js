/**
 * Babel Configuration for WatermelonDB
 *
 * CTO MANDATE: Required for decorator support in WatermelonDB models.
 * Uses legacy decorators and loose class properties for compatibility.
 */
module.exports = {
  presets: ['next/babel'],
  plugins: [
    ['@babel/plugin-proposal-decorators', { legacy: true }],
    ['@babel/plugin-transform-class-properties', { loose: true }],
  ],
};

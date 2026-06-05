// metro.config.js — Expo SDK 55 Metro configuration
// Extends expo/metro-config for proper web resolution and alias support

const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

module.exports = config;

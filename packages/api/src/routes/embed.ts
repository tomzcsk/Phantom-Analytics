import type { FastifyPluginAsync } from 'fastify'

/**
 * Serves the embeddable widget script at GET /embed.js
 * This is a lightweight script that fetches stats from the Public API
 * and renders a mini analytics widget.
 */

const EMBED_SCRIPT = `
(function() {
  'use strict';
  var STYLES = {
    widget: 'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#1A1D27;color:#E8E9ED;border-radius:12px;padding:20px;max-width:360px;border:1px solid #2A2D3A;',
    title: 'font-size:14px;font-weight:600;color:#A0A3B1;margin:0 0 16px;display:flex;align-items:center;gap:6px;',
    grid: 'display:grid;grid-template-columns:1fr 1fr;gap:12px;',
    card: 'background:#12141C;border-radius:8px;padding:12px;',
    label: 'font-size:11px;color:#6B6E7B;margin:0 0 4px;',
    value: 'font-size:22px;font-weight:700;color:#E8E9ED;margin:0;',
    footer: 'font-size:10px;color:#4A4D5A;margin:12px 0 0;text-align:right;',
    error: 'font-size:12px;color:#F75252;padding:16px;text-align:center;'
  };

  function fmt(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return String(n);
  }

  function fmtDuration(s) {
    if (s < 60) return s + 's';
    var m = Math.floor(s / 60);
    var sec = s % 60;
    return m + 'm ' + sec + 's';
  }

  function render(el, data) {
    el.innerHTML =
      '<div style="' + STYLES.widget + '">' +
        '<p style="' + STYLES.title + '">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4F8EF7" stroke-width="2"><path d="M3 3v18h18"/><path d="M18 9l-5 5-2-2-4 4"/></svg>' +
          ' Analytics' +
        '</p>' +
        '<div style="' + STYLES.grid + '">' +
          '<div style="' + STYLES.card + '">' +
            '<p style="' + STYLES.label + '">Pageviews</p>' +
            '<p style="' + STYLES.value + '">' + fmt(data.pageviews) + '</p>' +
          '</div>' +
          '<div style="' + STYLES.card + '">' +
            '<p style="' + STYLES.label + '">Visitors</p>' +
            '<p style="' + STYLES.value + '">' + fmt(data.visitors) + '</p>' +
          '</div>' +
          '<div style="' + STYLES.card + '">' +
            '<p style="' + STYLES.label + '">Bounce Rate</p>' +
            '<p style="' + STYLES.value + '">' + Math.round(data.bounce_rate * 100) + '%</p>' +
          '</div>' +
          '<div style="' + STYLES.card + '">' +
            '<p style="' + STYLES.label + '">Avg Duration</p>' +
            '<p style="' + STYLES.value + '">' + fmtDuration(data.avg_duration) + '</p>' +
          '</div>' +
        '</div>' +
        '<p style="' + STYLES.footer + '">' + data.period.from + ' — ' + data.period.to + '</p>' +
      '</div>';
  }

  function init() {
    var scripts = document.querySelectorAll('script[data-phantom-embed]');
    for (var i = 0; i < scripts.length; i++) {
      var script = scripts[i];
      var apiKey = script.getAttribute('data-api-key');
      var host = script.getAttribute('data-host') || script.src.replace(/\\/embed\\.js.*/, '');
      var containerId = script.getAttribute('data-container');

      if (!apiKey) continue;

      var container = containerId
        ? document.getElementById(containerId)
        : script.parentElement;

      if (!container) continue;

      (function(el, key, baseUrl) {
        var url = baseUrl + '/api/v1/stats';
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url);
        xhr.setRequestHeader('X-API-Key', key);
        xhr.onload = function() {
          if (xhr.status === 200) {
            try { render(el, JSON.parse(xhr.responseText)); }
            catch(e) { el.innerHTML = '<p style="' + STYLES.error + '">Parse error</p>'; }
          } else {
            el.innerHTML = '<p style="' + STYLES.error + '">Error: ' + xhr.status + '</p>';
          }
        };
        xhr.onerror = function() {
          el.innerHTML = '<p style="' + STYLES.error + '">Network error</p>';
        };
        xhr.send();
      })(container, apiKey, host);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
`.trim()

export const embedRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/embed.js', async (_request, reply) => {
    return reply
      .type('application/javascript; charset=utf-8')
      .header('Cache-Control', 'public, max-age=3600')
      .header('Access-Control-Allow-Origin', '*')
      .send(EMBED_SCRIPT)
  })
}

/*
 * Drop-in renderer for data/dashboard.json.
 *
 * Add this before </body>:
 * <script src="assets/dashboard-data-loader.js" defer></script>
 *
 * Then add empty containers where you want live data:
 * <div data-render="brand-score-cards"></div>
 * <div data-render="whitespace-topics"></div>
 * <div data-render="recommendations"></div>
 * <div data-render="evidence-feed"></div>
 * <span data-field="last_updated"></span>
 */

(function () {
  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function metricLabel(key) {
    return String(key || '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, function (char) { return char.toUpperCase(); });
  }

  function scoreClass(score) {
    if (score >= 80) return 'score-high';
    if (score >= 65) return 'score-medium';
    return 'score-low';
  }

  function movementText(value) {
    var number = Number(value || 0);
    if (number > 0) return '+' + number;
    return String(number);
  }

  function renderBrandScoreCards(brands) {
    return '<div class="dynamic-grid brand-score-grid">' + (brands || []).map(function (brand) {
      var metrics = brand.metrics || {};
      var metricHtml = Object.keys(metrics).map(function (key) {
        return '<div class="metric-row">' +
          '<span>' + escapeHtml(metricLabel(key)) + '</span>' +
          '<strong>' + escapeHtml(metrics[key]) + '</strong>' +
        '</div>';
      }).join('');

      return '<article class="dynamic-card brand-score-card">' +
        '<div class="card-kicker">' + escapeHtml(movementText(brand.movement_since_last_run)) + ' since last run</div>' +
        '<h3>' + escapeHtml(brand.name) + '</h3>' +
        '<div class="hero-score ' + scoreClass(Number(brand.competitiveness_score || 0)) + '">' + escapeHtml(brand.competitiveness_score || 0) + '</div>' +
        '<p>' + escapeHtml(brand.summary || '') + '</p>' +
        '<div class="metric-list">' + metricHtml + '</div>' +
      '</article>';
    }).join('') + '</div>';
  }

  function renderWhitespaceTopics(topics) {
    return '<div class="dynamic-list whitespace-list">' + (topics || []).map(function (topic) {
      return '<article class="dynamic-card whitespace-card">' +
        '<div class="card-kicker">Opportunity score: ' + escapeHtml(topic.opportunity_score || 0) + '</div>' +
        '<h3>' + escapeHtml(topic.topic) + '</h3>' +
        '<p>' + escapeHtml(topic.why_it_matters || '') + '</p>' +
        '<p><strong>Activation:</strong> ' + escapeHtml(topic.activation_idea || '') + '</p>' +
      '</article>';
    }).join('') + '</div>';
  }

  function renderRecommendations(recommendations) {
    return '<div class="dynamic-list recommendation-list">' + (recommendations || []).map(function (item) {
      return '<article class="dynamic-card recommendation-card">' +
        '<div class="card-kicker">' + escapeHtml(item.priority || 'Priority') + '</div>' +
        '<h3>' + escapeHtml(item.title) + '</h3>' +
        '<p>' + escapeHtml(item.why || '') + '</p>' +
        '<p><strong>Action:</strong> ' + escapeHtml(item.action || '') + '</p>' +
      '</article>';
    }).join('') + '</div>';
  }

  function renderEvidenceFeed(evidence) {
    return '<div class="dynamic-list evidence-list">' + (evidence || []).map(function (item) {
      return '<article class="dynamic-card evidence-card">' +
        '<div class="card-kicker">' + escapeHtml(item.brand || '') + ' - ' + escapeHtml(item.source_type || '') + '</div>' +
        '<h3><a href="' + escapeHtml(item.url || '#') + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(item.title || 'Public source') + '</a></h3>' +
        '<p>' + escapeHtml(item.snippet || '') + '</p>' +
        '<p><strong>B2B relevance:</strong> ' + escapeHtml(item.b2b_relevance_score || 0) + '/100</p>' +
      '</article>';
    }).join('') + '</div>';
  }

  function bindTextFields(data) {
    document.querySelectorAll('[data-field]').forEach(function (element) {
      var field = element.getAttribute('data-field');
      if (Object.prototype.hasOwnProperty.call(data, field)) {
        element.textContent = data[field];
      }
    });
  }

  function renderIntoContainers(data) {
    document.querySelectorAll('[data-render="brand-score-cards"]').forEach(function (element) {
      element.innerHTML = renderBrandScoreCards(data.brand_scores || []);
    });

    document.querySelectorAll('[data-render="whitespace-topics"]').forEach(function (element) {
      element.innerHTML = renderWhitespaceTopics(data.whitespace_topics || []);
    });

    document.querySelectorAll('[data-render="recommendations"]').forEach(function (element) {
      element.innerHTML = renderRecommendations(data.recommendations || []);
    });

    document.querySelectorAll('[data-render="evidence-feed"]').forEach(function (element) {
      element.innerHTML = renderEvidenceFeed(data.evidence_feed || []);
    });
  }

  function dashboardDataUrl() {
    var meta = document.querySelector('meta[name="dashboard-data-base"]');
    var base = meta && meta.getAttribute('content');
    if (base) return base.replace(/\/$/, '') + '/data/dashboard.json';
    return new URL('data/dashboard.json', document.baseURI).href;
  }

  async function loadDashboardData() {
    var response = await fetch(dashboardDataUrl(), { cache: 'no-store' });
    if (!response.ok) throw new Error('Could not load data/dashboard.json: HTTP ' + response.status);
    return response.json();
  }

  document.addEventListener('DOMContentLoaded', function () {
    loadDashboardData()
      .then(function (data) {
        bindTextFields(data);
        renderIntoContainers(data);
        document.documentElement.setAttribute('data-dashboard-loaded', 'true');
      })
      .catch(function (error) {
        console.error(error);
        document.querySelectorAll('[data-render]').forEach(function (element) {
          element.innerHTML = '<p class="dashboard-error">Dashboard data could not be loaded. Check that data/dashboard.json exists.</p>';
        });
      });
  });
})();

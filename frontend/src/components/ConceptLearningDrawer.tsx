import React, { useState } from 'react';
import type { PrerequisiteConcept } from '../types/umr';
import './ConceptLearningDrawer.css';

interface ConceptLearningDrawerProps {
  prerequisites: PrerequisiteConcept[];
  primaryConceptId?: string;
}

export const ConceptLearningDrawer: React.FC<ConceptLearningDrawerProps> = ({
  prerequisites,
  primaryConceptId
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(
    prerequisites.length > 0 ? prerequisites[0].id : null
  );

  if (!prerequisites || prerequisites.length === 0) {
    return null;
  }

  return (
    <div className="concept-learning-drawer" role="region" aria-label="Prerequisite Concepts Learning">
      <div className="drawer-header">
        <div className="header-title-row">
          <span className="badge-icon">💡</span>
          <div>
            <h4 className="drawer-title">
              Foundational Concepts Required {primaryConceptId ? `(${primaryConceptId})` : ''}
            </h4>
            <p className="drawer-subtitle">
              Master these core ideas to fully understand how this problem is solved (Powered by Mathua DAG):
            </p>
          </div>
        </div>
      </div>

      <div className="concept-cards-list">
        {prerequisites.map((concept, index) => {
          const isExpanded = expandedId === concept.id;
          return (
            <div
              key={concept.id}
              className={`concept-card ${isExpanded ? 'expanded' : ''}`}
            >
              <button
                className="concept-card-header"
                onClick={() => setExpandedId(isExpanded ? null : concept.id)}
                aria-expanded={isExpanded}
                aria-controls={`desc-${concept.id}`}
              >
                <div className="concept-num-title">
                  <span className="step-badge">{index + 1}</span>
                  <span className="concept-name">{concept.label}</span>
                  <span className="concept-domain">{concept.domain}</span>
                </div>
                <span className="toggle-icon">{isExpanded ? '▲' : '▼'}</span>
              </button>

              {isExpanded && (
                <div id={`desc-${concept.id}`} className="concept-card-body">
                  <p className="concept-desc">
                    {concept.description || 'Core mathematical prerequisite necessary for understanding this algebraic method.'}
                  </p>
                  <div className="concept-footer">
                    <span className="concept-id-tag">Concept ID: {concept.id}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

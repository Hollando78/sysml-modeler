import React, { useState } from 'react';
import type { SysMLNodeData } from '../../lib/sysml-diagram/types';
import type { SysMLParameter, SysMLInternalTransition, SysMLCondition, SysMLVariable, SysMLAttribute, SysMLPort, SysMLActionReference, SysMLModel, SysMLNodeSpec } from '../../types';
import { X, Save, Eye, EyeOff, Plus, Trash2, Link2, Unlink } from 'lucide-react';
import { ActionPicker } from './ActionPicker';
import { useSysMLMutations } from '../../hooks/useSysMLApi';

interface NodeEditorProps {
  nodeData: SysMLNodeData;
  onClose: () => void;
  onSave: (updates: Partial<SysMLNodeData>) => void;
  model?: SysMLModel; // Needed to fetch available actions
  viewpointId?: string; // Needed to assign actions to the correct viewpoint
}

export default function NodeEditor({ nodeData, onClose, onSave, model, viewpointId }: NodeEditorProps) {
  const [name, setName] = useState(nodeData.name);
  const [stereotype, setStereotype] = useState(nodeData.stereotype || '');
  const mutations = useSysMLMutations();

  // Action picker state
  const [actionPickerOpen, setActionPickerOpen] = useState(false);
  const [actionPickerTarget, setActionPickerTarget] = useState<'entry' | 'do' | 'exit' | null>(null);
  const [documentation, setDocumentation] = useState(nodeData.documentation || '');
  const [parameters, setParameters] = useState<SysMLParameter[]>(() => {
    // Parameters might be on spec or at the root level of nodeData
    if (nodeData.kind === 'action-definition' || nodeData.kind === 'action-usage') {
      // @ts-ignore - parameters might exist
      return (nodeData as any).parameters || (nodeData.spec as any)?.parameters || [];
    }
    return [];
  });

  // Internal transitions for states
  const [internalTransitions, setInternalTransitions] = useState<SysMLInternalTransition[]>(() => {
    if (nodeData.kind === 'state-definition' || nodeData.kind === 'state-usage') {
      // @ts-ignore
      return (nodeData as any).internalTransitions || (nodeData.spec as any)?.internalTransitions || [];
    }
    return [];
  });

  // State actions (entry/do/exit) - can be strings or action references
  const [entryAction, setEntryAction] = useState<string | SysMLActionReference | null>(() => {
    if (nodeData.kind === 'state-definition' || nodeData.kind === 'state-usage') {
      // @ts-ignore
      return (nodeData as any).entryAction || (nodeData.spec as any)?.entryAction || null;
    }
    return null;
  });

  const [doAction, setDoAction] = useState<string | SysMLActionReference | null>(() => {
    if (nodeData.kind === 'state-definition' || nodeData.kind === 'state-usage') {
      // @ts-ignore
      return (nodeData as any).doActivity || (nodeData.spec as any)?.doActivity || null;
    }
    return null;
  });

  const [exitAction, setExitAction] = useState<string | SysMLActionReference | null>(() => {
    if (nodeData.kind === 'state-definition' || nodeData.kind === 'state-usage') {
      // @ts-ignore
      return (nodeData as any).exitAction || (nodeData.spec as any)?.exitAction || null;
    }
    return null;
  });

  // Port interface
  const [portInterface, setPortInterface] = useState<string>(() => {
    if (nodeData.kind === 'port-definition' || nodeData.kind === 'port-usage') {
      // @ts-ignore
      return (nodeData as any).interface || (nodeData.spec as any)?.interface || '';
    }
    return '';
  });

  // Action preconditions, postconditions, and local variables
  const [preconditions, setPreconditions] = useState<SysMLCondition[]>(() => {
    if (nodeData.kind === 'action-definition' || nodeData.kind === 'action-usage') {
      // @ts-ignore
      return (nodeData as any).preconditions || (nodeData.spec as any)?.preconditions || [];
    }
    return [];
  });

  const [postconditions, setPostconditions] = useState<SysMLCondition[]>(() => {
    if (nodeData.kind === 'action-definition' || nodeData.kind === 'action-usage') {
      // @ts-ignore
      return (nodeData as any).postconditions || (nodeData.spec as any)?.postconditions || [];
    }
    return [];
  });

  const [localVariables, setLocalVariables] = useState<SysMLVariable[]>(() => {
    if (nodeData.kind === 'action-definition' || nodeData.kind === 'action-usage') {
      // @ts-ignore
      return (nodeData as any).localVariables || (nodeData.spec as any)?.localVariables || [];
    }
    return [];
  });

  // Attributes and ports for parts
  const [attributes, setAttributes] = useState<SysMLAttribute[]>(() => {
    if (nodeData.kind === 'part-definition' || nodeData.kind === 'part-usage') {
      // @ts-ignore
      return (nodeData as any).attributes || (nodeData.spec as any)?.attributes || [];
    }
    return [];
  });

  const [ports, setPorts] = useState<SysMLPort[]>(() => {
    if (nodeData.kind === 'part-definition' || nodeData.kind === 'part-usage') {
      // @ts-ignore
      return (nodeData as any).ports || (nodeData.spec as any)?.ports || [];
    }
    return [];
  });

  // Use case fields
  const [actors, setActors] = useState<string[]>(() => {
    if (nodeData.kind === 'use-case-usage') {
      // @ts-ignore
      return (nodeData as any).actors || (nodeData.spec as any)?.actors || [];
    }
    return [];
  });

  const [includes, setIncludes] = useState<string[]>(() => {
    if (nodeData.kind === 'use-case-definition' || nodeData.kind === 'use-case-usage') {
      // @ts-ignore
      const spec = (nodeData.spec as any) || {};
      return (nodeData as any).includes || spec.includes || spec.includedUseCases || [];
    }
    return [];
  });

  const [extendsList, setExtendsList] = useState<string[]>(() => {
    if (nodeData.kind === 'use-case-usage') {
      // @ts-ignore
      return (nodeData as any).extends || (nodeData.spec as any)?.extends || [];
    }
    return [];
  });

  const [objectiveRequirement, setObjectiveRequirement] = useState<string>(() => {
    if (nodeData.kind === 'use-case-definition') {
      // @ts-ignore
      return (nodeData as any).objectiveRequirement || (nodeData.spec as any)?.objectiveRequirement || '';
    }
    return '';
  });

  const [subjectParameter, setSubjectParameter] = useState<string>(() => {
    if (nodeData.kind === 'use-case-definition') {
      // @ts-ignore
      return (nodeData as any).subjectParameter || (nodeData.spec as any)?.subjectParameter || '';
    }
    return '';
  });

  const [compartmentVisibility, setCompartmentVisibility] = useState<Record<number, boolean>>(() => {
    // Initialize all compartments as visible
    const visibility: Record<number, boolean> = {};
    nodeData.compartments?.forEach((_, index) => {
      visibility[index] = true;
    });
    return visibility;
  });

  // Get available actions from the model
  const availableActions = React.useMemo(() => {
    if (!model) return [];
    return model.nodes
      .filter((node) => node.kind === 'action-definition' || node.kind === 'action-usage')
      .map((node) => ({
        id: node.spec.id,
        name: node.spec.name,
        kind: node.kind as 'action-definition' | 'action-usage',
        definition: node.kind === 'action-usage' ? node.spec.definition : undefined,
      }));
  }, [model]);

  // Handle action picker selection
  const handleActionSelect = (actionRef: SysMLActionReference) => {
    if (actionPickerTarget === 'entry') {
      setEntryAction(actionRef);
    } else if (actionPickerTarget === 'do') {
      setDoAction(actionRef);
    } else if (actionPickerTarget === 'exit') {
      setExitAction(actionRef);
    }
    setActionPickerOpen(false);
    setActionPickerTarget(null);
  };

  // Open action picker for a specific action
  const openActionPicker = (target: 'entry' | 'do' | 'exit') => {
    setActionPickerTarget(target);
    setActionPickerOpen(true);
  };

  // Unlink action (convert to null)
  const unlinkAction = (target: 'entry' | 'do' | 'exit') => {
    if (target === 'entry') {
      setEntryAction(null);
    } else if (target === 'do') {
      setDoAction(null);
    } else if (target === 'exit') {
      setExitAction(null);
    }
  };

  // Get display value for action
  const getActionDisplay = (action: string | SysMLActionReference | null): string => {
    if (!action) return '';
    if (typeof action === 'string') return action;
    return action.actionName;
  };

  // Check if action is a reference
  const isActionReference = (action: string | SysMLActionReference | null): action is SysMLActionReference => {
    return action !== null && typeof action === 'object' && 'actionId' in action;
  };

  // Create an Action Definition from text and link it
  const createActionFromText = async (target: 'entry' | 'do' | 'exit') => {
    const actionText = target === 'entry' ? entryAction : target === 'do' ? doAction : exitAction;

    if (!actionText || typeof actionText !== 'string' || !actionText.trim()) {
      return;
    }

    const actionName = actionText.trim();

    // Create a new Action Definition
    const newActionId = `action-definition-${Date.now()}`;
    const newAction: SysMLNodeSpec = {
      kind: 'action-definition',
      spec: {
        id: newActionId,
        name: actionName,
        viewpointId: viewpointId, // Assign to current viewpoint
      }
    };

    try {
      await mutations.createElement.mutateAsync(newAction);

      // Create action reference and link it
      const actionRef: SysMLActionReference = {
        actionId: newActionId,
        actionType: 'action-definition',
        actionName: actionName,
      };

      // Update the state with the new reference
      if (target === 'entry') {
        setEntryAction(actionRef);
      } else if (target === 'do') {
        setDoAction(actionRef);
      } else if (target === 'exit') {
        setExitAction(actionRef);
      }
    } catch (error) {
      console.error('Failed to create action:', error);
      alert('Failed to create action. Please try again.');
    }
  };

  const handleSave = () => {
    const updates: any = {
      name,
      stereotype: stereotype.trim() || undefined,
      documentation: documentation.trim() || undefined,
    };

    // Add parameters for action definitions/usages
    // Parameters need to be at the root level for the backend to process them
    if (nodeData.kind === 'action-definition' || nodeData.kind === 'action-usage') {
      updates.parameters = parameters;
      updates.preconditions = preconditions.length > 0 ? preconditions : undefined;
      updates.postconditions = postconditions.length > 0 ? postconditions : undefined;
      updates.localVariables = localVariables.length > 0 ? localVariables : undefined;
    }

    // Add internal transitions and actions for states
    if (nodeData.kind === 'state-definition' || nodeData.kind === 'state-usage') {
      // Always send internalTransitions to allow clearing
      updates.internalTransitions = internalTransitions.length > 0 ? internalTransitions : [];
      // Actions can be strings or action references
      updates.entryAction = entryAction || null;
      updates.doActivity = doAction || null;
      updates.exitAction = exitAction || null;
    }

    // Add interface for ports
    if (nodeData.kind === 'port-definition' || nodeData.kind === 'port-usage') {
      updates.interface = portInterface.trim() || undefined;
    }

    // Add attributes and ports for parts
    if (nodeData.kind === 'part-definition' || nodeData.kind === 'part-usage') {
      updates.attributes = attributes.length > 0 ? attributes : undefined;
      updates.ports = ports.length > 0 ? ports : undefined;
    }

    // Add use case fields
    if (nodeData.kind === 'use-case-definition') {
      updates.subjectParameter = subjectParameter.trim() || undefined;
      updates.objectiveRequirement = objectiveRequirement.trim() || undefined;
      updates.includedUseCases = includes.filter(i => i.trim()).length > 0 ? includes.filter(i => i.trim()) : undefined;
    }

    if (nodeData.kind === 'use-case-usage') {
      updates.actors = actors.filter(a => a.trim()).length > 0 ? actors.filter(a => a.trim()) : undefined;
      updates.includes = includes.filter(i => i.trim()).length > 0 ? includes.filter(i => i.trim()) : undefined;
      updates.extends = extendsList.filter(e => e.trim()).length > 0 ? extendsList.filter(e => e.trim()) : undefined;
    }

    // Filter compartments based on visibility
    if (nodeData.compartments) {
      updates.compartments = nodeData.compartments.filter((_, index) => compartmentVisibility[index]);
    }

    console.log('[DEBUG] Saving node with updates:', updates);

    onSave(updates);
    onClose();
  };

  const addParameter = () => {
    setParameters([...parameters, { name: '', direction: 'in', type: '' }]);
  };

  const removeParameter = (index: number) => {
    setParameters(parameters.filter((_, i) => i !== index));
  };

  const updateParameter = (index: number, field: keyof SysMLParameter, value: string) => {
    const updated = [...parameters];
    updated[index] = { ...updated[index], [field]: value };
    setParameters(updated);
  };

  // Internal transition management
  const addInternalTransition = () => {
    setInternalTransitions([...internalTransitions, { trigger: '', guard: '', effect: '' }]);
  };

  const removeInternalTransition = (index: number) => {
    setInternalTransitions(internalTransitions.filter((_, i) => i !== index));
  };

  const updateInternalTransition = (index: number, field: keyof SysMLInternalTransition, value: string) => {
    const updated = [...internalTransitions];
    updated[index] = { ...updated[index], [field]: value };
    setInternalTransitions(updated);
  };

  // Use case management
  const addActor = () => {
    setActors([...actors, '']);
  };

  const removeActor = (index: number) => {
    setActors(actors.filter((_, i) => i !== index));
  };

  const updateActor = (index: number, value: string) => {
    const updated = [...actors];
    updated[index] = value;
    setActors(updated);
  };

  const addInclude = () => {
    setIncludes([...includes, '']);
  };

  const removeInclude = (index: number) => {
    setIncludes(includes.filter((_, i) => i !== index));
  };

  const updateInclude = (index: number, value: string) => {
    const updated = [...includes];
    updated[index] = value;
    setIncludes(updated);
  };

  const addExtend = () => {
    setExtendsList([...extendsList, '']);
  };

  const removeExtend = (index: number) => {
    setExtendsList(extendsList.filter((_, i) => i !== index));
  };

  const updateExtend = (index: number, value: string) => {
    const updated = [...extendsList];
    updated[index] = value;
    setExtendsList(updated);
  };

  // Precondition management
  const addPrecondition = () => {
    setPreconditions([...preconditions, { expression: '' }]);
  };

  const removePrecondition = (index: number) => {
    setPreconditions(preconditions.filter((_, i) => i !== index));
  };

  const updatePrecondition = (index: number, value: string) => {
    const updated = [...preconditions];
    updated[index] = { expression: value };
    setPreconditions(updated);
  };

  // Postcondition management
  const addPostcondition = () => {
    setPostconditions([...postconditions, { expression: '' }]);
  };

  const removePostcondition = (index: number) => {
    setPostconditions(postconditions.filter((_, i) => i !== index));
  };

  const updatePostcondition = (index: number, value: string) => {
    const updated = [...postconditions];
    updated[index] = { expression: value };
    setPostconditions(updated);
  };

  // Local variable management
  const addLocalVariable = () => {
    setLocalVariables([...localVariables, { name: '', type: '', initialValue: '' }]);
  };

  const removeLocalVariable = (index: number) => {
    setLocalVariables(localVariables.filter((_, i) => i !== index));
  };

  const updateLocalVariable = (index: number, field: keyof SysMLVariable, value: string) => {
    const updated = [...localVariables];
    updated[index] = { ...updated[index], [field]: value };
    setLocalVariables(updated);
  };

  // Attribute management
  const addAttribute = () => {
    setAttributes([...attributes, { name: '', type: '', multiplicity: '', value: '' }]);
  };

  const removeAttribute = (index: number) => {
    setAttributes(attributes.filter((_, i) => i !== index));
  };

  const updateAttribute = (index: number, field: keyof SysMLAttribute, value: string) => {
    const updated = [...attributes];
    updated[index] = { ...updated[index], [field]: value };
    setAttributes(updated);
  };

  // Port management
  const addPort = () => {
    setPorts([...ports, { name: '', type: '', direction: 'in' }]);
  };

  const removePort = (index: number) => {
    setPorts(ports.filter((_, i) => i !== index));
  };

  const updatePort = (index: number, field: keyof SysMLPort, value: string) => {
    const updated = [...ports];
    updated[index] = { ...updated[index], [field]: value };
    setPorts(updated);
  };

  const toggleCompartmentVisibility = (index: number) => {
    setCompartmentVisibility(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const formatKind = (kind: string) => {
    return kind
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <div>
            <h2 style={styles.title}>Edit {formatKind(nodeData.kind)}</h2>
            <div style={styles.subtitle}>ID: {nodeData.id}</div>
          </div>
          <button type="button" style={styles.closeButton} onClick={onClose}>
            {React.createElement(X, { size: 24 })}
          </button>
        </div>

        {/* Content */}
        <div style={styles.content}>
          {/* Name */}
          <div style={styles.field}>
            <label style={styles.label}>Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={styles.input}
              placeholder="Element name"
              autoFocus
            />
          </div>

          {/* Stereotype */}
          <div style={styles.field}>
            <label style={styles.label}>
              Stereotype
              <span style={styles.hint}> (optional, e.g., «block», «interface»)</span>
            </label>
            <input
              type="text"
              value={stereotype}
              onChange={(e) => setStereotype(e.target.value)}
              style={styles.input}
              placeholder="«stereotype»"
            />
          </div>

          {/* Documentation */}
          <div style={styles.field}>
            <label style={styles.label}>
              Documentation
              <span style={styles.hint}> (optional)</span>
            </label>
            <textarea
              value={documentation}
              onChange={(e) => setDocumentation(e.target.value)}
              style={styles.textarea}
              placeholder="Description of this element..."
              rows={4}
            />
          </div>

          {/* Attributes (for part definitions/usages) */}
          {(nodeData.kind === 'part-definition' || nodeData.kind === 'part-usage') && (
            <div style={styles.field}>
              <div style={styles.parameterHeader}>
                <label style={styles.label}>Attributes</label>
                <button
                  type="button"
                  style={styles.addButton}
                  onClick={addAttribute}
                  title="Add attribute"
                >
                  {React.createElement(Plus, { size: 16 })}
                  <span>Add Attribute</span>
                </button>
              </div>
              {attributes.length === 0 ? (
                <div style={styles.emptyMessage}>No attributes defined</div>
              ) : (
                <div style={styles.parameterList}>
                  {attributes.map((attr, index) => (
                    <div key={index} style={styles.parameterItem}>
                      <input
                        type="text"
                        value={attr.name}
                        onChange={(e) => updateAttribute(index, 'name', e.target.value)}
                        style={styles.paramInput}
                        placeholder="name"
                      />
                      <input
                        type="text"
                        value={attr.type || ''}
                        onChange={(e) => updateAttribute(index, 'type', e.target.value)}
                        style={styles.paramInput}
                        placeholder="type (optional)"
                      />
                      <input
                        type="text"
                        value={attr.multiplicity || ''}
                        onChange={(e) => updateAttribute(index, 'multiplicity', e.target.value)}
                        style={{ ...styles.paramInput, width: '80px' }}
                        placeholder="[0..1]"
                      />
                      <input
                        type="text"
                        value={attr.value || ''}
                        onChange={(e) => updateAttribute(index, 'value', e.target.value)}
                        style={styles.paramInput}
                        placeholder="default value"
                      />
                      <button
                        type="button"
                        style={styles.removeButton}
                        onClick={() => removeAttribute(index)}
                        title="Remove attribute"
                      >
                        {React.createElement(Trash2, { size: 16 })}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Ports (for part definitions/usages) */}
          {(nodeData.kind === 'part-definition' || nodeData.kind === 'part-usage') && (
            <div style={styles.field}>
              <div style={styles.parameterHeader}>
                <label style={styles.label}>Ports</label>
                <button
                  type="button"
                  style={styles.addButton}
                  onClick={addPort}
                  title="Add port"
                >
                  {React.createElement(Plus, { size: 16 })}
                  <span>Add Port</span>
                </button>
              </div>
              {ports.length === 0 ? (
                <div style={styles.emptyMessage}>No ports defined</div>
              ) : (
                <div style={styles.parameterList}>
                  {ports.map((port, index) => (
                    <div key={index} style={styles.parameterItem}>
                      <input
                        type="text"
                        value={port.name}
                        onChange={(e) => updatePort(index, 'name', e.target.value)}
                        style={styles.paramInput}
                        placeholder="name"
                      />
                      <select
                        value={port.direction || 'in'}
                        onChange={(e) => updatePort(index, 'direction', e.target.value)}
                        style={styles.paramSelect}
                      >
                        <option value="in">in</option>
                        <option value="out">out</option>
                        <option value="inout">inout</option>
                      </select>
                      <input
                        type="text"
                        value={port.type || ''}
                        onChange={(e) => updatePort(index, 'type', e.target.value)}
                        style={styles.paramInput}
                        placeholder="type (optional)"
                      />
                      <button
                        type="button"
                        style={styles.removeButton}
                        onClick={() => removePort(index)}
                        title="Remove port"
                      >
                        {React.createElement(Trash2, { size: 16 })}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Parameters (for action definitions/usages) */}
          {(nodeData.kind === 'action-definition' || nodeData.kind === 'action-usage') && (
            <div style={styles.field}>
              <div style={styles.parameterHeader}>
                <label style={styles.label}>Parameters</label>
                <button
                  type="button"
                  style={styles.addButton}
                  onClick={addParameter}
                  title="Add parameter"
                >
                  {React.createElement(Plus, { size: 16 })}
                  <span>Add Parameter</span>
                </button>
              </div>
              {parameters.length === 0 ? (
                <div style={styles.emptyMessage}>No parameters defined</div>
              ) : (
                <div style={styles.parameterList}>
                  {parameters.map((param, index) => {
                    // @ts-ignore - inherited property might exist
                    const isInherited = param.inherited === true;
                    const itemStyle = isInherited ? styles.parameterItemInherited : styles.parameterItem;
                    const inputDisabled = isInherited;

                    return (
                      <div key={index} style={itemStyle}>
                        {isInherited && (
                          <div style={styles.inheritedBadge}>inherited</div>
                        )}
                        <input
                          type="text"
                          value={param.name}
                          onChange={(e) => updateParameter(index, 'name', e.target.value)}
                          style={styles.paramInput}
                          placeholder="name"
                          disabled={inputDisabled}
                        />
                        <select
                          value={param.direction}
                          onChange={(e) => updateParameter(index, 'direction', e.target.value)}
                          style={styles.paramSelect}
                          disabled={inputDisabled}
                        >
                          <option value="in">in</option>
                          <option value="out">out</option>
                          <option value="inout">inout</option>
                        </select>
                        <input
                          type="text"
                          value={param.type || ''}
                          onChange={(e) => updateParameter(index, 'type', e.target.value)}
                          style={styles.paramInput}
                          placeholder="type (optional)"
                          disabled={inputDisabled}
                        />
                        {!isInherited && (
                          <button
                            type="button"
                            style={styles.removeButton}
                            onClick={() => removeParameter(index)}
                            title="Remove parameter"
                          >
                            {React.createElement(Trash2, { size: 16 })}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Preconditions (for action definitions/usages) */}
          {(nodeData.kind === 'action-definition' || nodeData.kind === 'action-usage') && (
            <div style={styles.field}>
              <div style={styles.parameterHeader}>
                <label style={styles.label}>Preconditions</label>
                <button
                  type="button"
                  style={styles.addButton}
                  onClick={addPrecondition}
                  title="Add precondition"
                >
                  {React.createElement(Plus, { size: 16 })}
                  <span>Add Precondition</span>
                </button>
              </div>
              {preconditions.length === 0 ? (
                <div style={styles.emptyMessage}>No preconditions defined</div>
              ) : (
                <div style={styles.parameterList}>
                  {preconditions.map((cond, index) => (
                    <div key={index} style={styles.conditionItem}>
                      <input
                        type="text"
                        value={cond.expression}
                        onChange={(e) => updatePrecondition(index, e.target.value)}
                        style={styles.conditionInput}
                        placeholder="Boolean expression (e.g., x > 0)"
                      />
                      <button
                        type="button"
                        style={styles.removeButton}
                        onClick={() => removePrecondition(index)}
                        title="Remove precondition"
                      >
                        {React.createElement(Trash2, { size: 16 })}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Postconditions (for action definitions/usages) */}
          {(nodeData.kind === 'action-definition' || nodeData.kind === 'action-usage') && (
            <div style={styles.field}>
              <div style={styles.parameterHeader}>
                <label style={styles.label}>Postconditions</label>
                <button
                  type="button"
                  style={styles.addButton}
                  onClick={addPostcondition}
                  title="Add postcondition"
                >
                  {React.createElement(Plus, { size: 16 })}
                  <span>Add Postcondition</span>
                </button>
              </div>
              {postconditions.length === 0 ? (
                <div style={styles.emptyMessage}>No postconditions defined</div>
              ) : (
                <div style={styles.parameterList}>
                  {postconditions.map((cond, index) => (
                    <div key={index} style={styles.conditionItem}>
                      <input
                        type="text"
                        value={cond.expression}
                        onChange={(e) => updatePostcondition(index, e.target.value)}
                        style={styles.conditionInput}
                        placeholder="Boolean expression (e.g., result != null)"
                      />
                      <button
                        type="button"
                        style={styles.removeButton}
                        onClick={() => removePostcondition(index)}
                        title="Remove postcondition"
                      >
                        {React.createElement(Trash2, { size: 16 })}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Local Variables (for action definitions/usages) */}
          {(nodeData.kind === 'action-definition' || nodeData.kind === 'action-usage') && (
            <div style={styles.field}>
              <div style={styles.parameterHeader}>
                <label style={styles.label}>Local Variables</label>
                <button
                  type="button"
                  style={styles.addButton}
                  onClick={addLocalVariable}
                  title="Add local variable"
                >
                  {React.createElement(Plus, { size: 16 })}
                  <span>Add Variable</span>
                </button>
              </div>
              {localVariables.length === 0 ? (
                <div style={styles.emptyMessage}>No local variables defined</div>
              ) : (
                <div style={styles.parameterList}>
                  {localVariables.map((variable, index) => (
                    <div key={index} style={styles.parameterItem}>
                      <input
                        type="text"
                        value={variable.name}
                        onChange={(e) => updateLocalVariable(index, 'name', e.target.value)}
                        style={styles.paramInput}
                        placeholder="name"
                      />
                      <input
                        type="text"
                        value={variable.type || ''}
                        onChange={(e) => updateLocalVariable(index, 'type', e.target.value)}
                        style={styles.paramInput}
                        placeholder="type (optional)"
                      />
                      <input
                        type="text"
                        value={variable.initialValue || ''}
                        onChange={(e) => updateLocalVariable(index, 'initialValue', e.target.value)}
                        style={styles.paramInput}
                        placeholder="initial value (optional)"
                      />
                      <button
                        type="button"
                        style={styles.removeButton}
                        onClick={() => removeLocalVariable(index)}
                        title="Remove variable"
                      >
                        {React.createElement(Trash2, { size: 16 })}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* State Actions (for state definitions/usages) */}
          {(nodeData.kind === 'state-definition' || nodeData.kind === 'state-usage') && (
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>State Behaviors</h3>
              <div style={styles.field}>
                <label style={styles.label}>Entry Action</label>
                <div style={styles.actionFieldWrapper}>
                  <div style={styles.actionDisplay}>
                    {isActionReference(entryAction) ? (
                      <div style={styles.actionReferenceDisplay}>
                        {React.createElement(Link2, { size: 14, style: { color: '#007bff' } })}
                        <span style={styles.actionReferenceName}>{entryAction.actionName}</span>
                        <span style={styles.actionReferenceType}>
                          ({entryAction.actionType === 'action-definition' ? 'Definition' : 'Usage'})
                        </span>
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={getActionDisplay(entryAction)}
                        onChange={(e) => setEntryAction(e.target.value || null)}
                        style={styles.input}
                        placeholder="Action to execute when entering this state"
                        disabled={isActionReference(entryAction)}
                      />
                    )}
                  </div>
                  <div style={styles.actionButtons}>
                    {isActionReference(entryAction) ? (
                      <button
                        type="button"
                        style={styles.unlinkButton}
                        onClick={() => unlinkAction('entry')}
                        title="Unlink action reference"
                      >
                        {React.createElement(Unlink, { size: 16 })}
                      </button>
                    ) : (
                      <>
                        {entryAction && typeof entryAction === 'string' && entryAction.trim() && (
                          <button
                            type="button"
                            style={styles.createButton}
                            onClick={() => createActionFromText('entry')}
                            title="Create action definition from text and link it"
                          >
                            {React.createElement(Plus, { size: 16 })}
                          </button>
                        )}
                        <button
                          type="button"
                          style={styles.linkButton}
                          onClick={() => openActionPicker('entry')}
                          title="Link to existing action definition/usage"
                        >
                          {React.createElement(Link2, { size: 16 })}
                        </button>
                        {entryAction && (
                          <button
                            type="button"
                            style={styles.removeButton}
                            onClick={() => unlinkAction('entry')}
                            title="Clear entry action"
                          >
                            {React.createElement(X, { size: 16 })}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Do Action</label>
                <div style={styles.actionFieldWrapper}>
                  <div style={styles.actionDisplay}>
                    {isActionReference(doAction) ? (
                      <div style={styles.actionReferenceDisplay}>
                        {React.createElement(Link2, { size: 14, style: { color: '#007bff' } })}
                        <span style={styles.actionReferenceName}>{doAction.actionName}</span>
                        <span style={styles.actionReferenceType}>
                          ({doAction.actionType === 'action-definition' ? 'Definition' : 'Usage'})
                        </span>
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={getActionDisplay(doAction)}
                        onChange={(e) => setDoAction(e.target.value || null)}
                        style={styles.input}
                        placeholder="Ongoing activity while in this state"
                        disabled={isActionReference(doAction)}
                      />
                    )}
                  </div>
                  <div style={styles.actionButtons}>
                    {isActionReference(doAction) ? (
                      <button
                        type="button"
                        style={styles.unlinkButton}
                        onClick={() => unlinkAction('do')}
                        title="Unlink action reference"
                      >
                        {React.createElement(Unlink, { size: 16 })}
                      </button>
                    ) : (
                      <>
                        {doAction && typeof doAction === 'string' && doAction.trim() && (
                          <button
                            type="button"
                            style={styles.createButton}
                            onClick={() => createActionFromText('do')}
                            title="Create action definition from text and link it"
                          >
                            {React.createElement(Plus, { size: 16 })}
                          </button>
                        )}
                        <button
                          type="button"
                          style={styles.linkButton}
                          onClick={() => openActionPicker('do')}
                          title="Link to existing action definition/usage"
                        >
                          {React.createElement(Link2, { size: 16 })}
                        </button>
                        {doAction && (
                          <button
                            type="button"
                            style={styles.removeButton}
                            onClick={() => unlinkAction('do')}
                            title="Clear do action"
                          >
                            {React.createElement(X, { size: 16 })}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Exit Action</label>
                <div style={styles.actionFieldWrapper}>
                  <div style={styles.actionDisplay}>
                    {isActionReference(exitAction) ? (
                      <div style={styles.actionReferenceDisplay}>
                        {React.createElement(Link2, { size: 14, style: { color: '#007bff' } })}
                        <span style={styles.actionReferenceName}>{exitAction.actionName}</span>
                        <span style={styles.actionReferenceType}>
                          ({exitAction.actionType === 'action-definition' ? 'Definition' : 'Usage'})
                        </span>
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={getActionDisplay(exitAction)}
                        onChange={(e) => setExitAction(e.target.value || null)}
                        style={styles.input}
                        placeholder="Action to execute when exiting this state"
                        disabled={isActionReference(exitAction)}
                      />
                    )}
                  </div>
                  <div style={styles.actionButtons}>
                    {isActionReference(exitAction) ? (
                      <button
                        type="button"
                        style={styles.unlinkButton}
                        onClick={() => unlinkAction('exit')}
                        title="Unlink action reference"
                      >
                        {React.createElement(Unlink, { size: 16 })}
                      </button>
                    ) : (
                      <>
                        {exitAction && typeof exitAction === 'string' && exitAction.trim() && (
                          <button
                            type="button"
                            style={styles.createButton}
                            onClick={() => createActionFromText('exit')}
                            title="Create action definition from text and link it"
                          >
                            {React.createElement(Plus, { size: 16 })}
                          </button>
                        )}
                        <button
                          type="button"
                          style={styles.linkButton}
                          onClick={() => openActionPicker('exit')}
                          title="Link to existing action definition/usage"
                        >
                          {React.createElement(Link2, { size: 16 })}
                        </button>
                        {exitAction && (
                          <button
                            type="button"
                            style={styles.removeButton}
                            onClick={() => unlinkAction('exit')}
                            title="Clear exit action"
                          >
                            {React.createElement(X, { size: 16 })}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Internal Transitions */}
              <div style={styles.field}>
              <div style={styles.parameterHeader}>
                <label style={styles.label}>Internal Transitions</label>
                <button
                  type="button"
                  style={styles.addButton}
                  onClick={addInternalTransition}
                  title="Add internal transition"
                >
                  {React.createElement(Plus, { size: 16 })}
                  <span>Add Transition</span>
                </button>
              </div>
              {internalTransitions.length === 0 ? (
                <div style={styles.emptyMessage}>No internal transitions defined</div>
              ) : (
                <div style={styles.parameterList}>
                  {internalTransitions.map((transition, index) => (
                    <div key={index} style={styles.transitionItem}>
                      <input
                        type="text"
                        value={transition.trigger || ''}
                        onChange={(e) => updateInternalTransition(index, 'trigger', e.target.value)}
                        style={styles.paramInput}
                        placeholder="trigger (optional)"
                      />
                      <input
                        type="text"
                        value={transition.guard || ''}
                        onChange={(e) => updateInternalTransition(index, 'guard', e.target.value)}
                        style={styles.paramInput}
                        placeholder="guard (optional)"
                      />
                      <input
                        type="text"
                        value={transition.effect || ''}
                        onChange={(e) => updateInternalTransition(index, 'effect', e.target.value)}
                        style={styles.paramInput}
                        placeholder="effect (optional)"
                      />
                      <button
                        type="button"
                        style={styles.removeButton}
                        onClick={() => removeInternalTransition(index)}
                        title="Remove transition"
                      >
                        {React.createElement(Trash2, { size: 16 })}
                      </button>
                    </div>
                  ))}
                </div>
              )}
              </div>
            </div>
          )}

          {/* Use Case Editing */}
          {(nodeData.kind === 'use-case-definition' || nodeData.kind === 'use-case-usage') && (
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Use Case Properties</h3>

              {/* Subject Parameter (for definitions) */}
              {nodeData.kind === 'use-case-definition' && (
                <div style={styles.field}>
                  <label style={styles.label}>Subject Parameter</label>
                  <input
                    type="text"
                    value={subjectParameter}
                    onChange={(e) => setSubjectParameter(e.target.value)}
                    style={styles.input}
                    placeholder="Subject of this use case (optional)"
                  />
                </div>
              )}

              {/* Objective Requirement (for definitions) */}
              {nodeData.kind === 'use-case-definition' && (
                <div style={styles.field}>
                  <label style={styles.label}>Objective Requirement</label>
                  <input
                    type="text"
                    value={objectiveRequirement}
                    onChange={(e) => setObjectiveRequirement(e.target.value)}
                    style={styles.input}
                    placeholder="Objective requirement (optional)"
                  />
                </div>
              )}

              {/* Actors (for usages) */}
              {nodeData.kind === 'use-case-usage' && (
                <div style={styles.field}>
                  <div style={styles.parameterHeader}>
                    <label style={styles.label}>Actors</label>
                    <button
                      type="button"
                      style={styles.addButton}
                      onClick={addActor}
                      title="Add actor"
                    >
                      {React.createElement(Plus, { size: 16 })}
                      <span>Add Actor</span>
                    </button>
                  </div>
                  {actors.length === 0 ? (
                    <div style={styles.emptyMessage}>No actors defined</div>
                  ) : (
                    <div style={styles.parameterList}>
                      {actors.map((actor, index) => (
                        <div key={index} style={styles.parameterItem}>
                          <input
                            type="text"
                            value={actor}
                            onChange={(e) => updateActor(index, e.target.value)}
                            style={styles.paramInput}
                            placeholder="Actor name"
                          />
                          <button
                            type="button"
                            style={styles.removeButton}
                            onClick={() => removeActor(index)}
                            title="Remove actor"
                          >
                            {React.createElement(Trash2, { size: 16 })}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Includes */}
              <div style={styles.field}>
                <div style={styles.parameterHeader}>
                  <label style={styles.label}>Includes</label>
                  <button
                    type="button"
                    style={styles.addButton}
                    onClick={addInclude}
                    title="Add included use case"
                  >
                    {React.createElement(Plus, { size: 16 })}
                    <span>Add Include</span>
                  </button>
                </div>
                {includes.length === 0 ? (
                  <div style={styles.emptyMessage}>No included use cases</div>
                ) : (
                  <div style={styles.parameterList}>
                    {includes.map((include, index) => (
                      <div key={index} style={styles.parameterItem}>
                        <input
                          type="text"
                          value={include}
                          onChange={(e) => updateInclude(index, e.target.value)}
                          style={styles.paramInput}
                          placeholder="Included use case name"
                        />
                        <button
                          type="button"
                          style={styles.removeButton}
                          onClick={() => removeInclude(index)}
                          title="Remove include"
                        >
                          {React.createElement(Trash2, { size: 16 })}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Extends (for usages) */}
              {nodeData.kind === 'use-case-usage' && (
                <div style={styles.field}>
                  <div style={styles.parameterHeader}>
                    <label style={styles.label}>Extends</label>
                    <button
                      type="button"
                      style={styles.addButton}
                      onClick={addExtend}
                      title="Add extended use case"
                    >
                      {React.createElement(Plus, { size: 16 })}
                      <span>Add Extend</span>
                    </button>
                  </div>
                  {extendsList.length === 0 ? (
                    <div style={styles.emptyMessage}>No extended use cases</div>
                  ) : (
                    <div style={styles.parameterList}>
                      {extendsList.map((extend, index) => (
                        <div key={index} style={styles.parameterItem}>
                          <input
                            type="text"
                            value={extend}
                            onChange={(e) => updateExtend(index, e.target.value)}
                            style={styles.paramInput}
                            placeholder="Extended use case name"
                          />
                          <button
                            type="button"
                            style={styles.removeButton}
                            onClick={() => removeExtend(index)}
                            title="Remove extend"
                          >
                            {React.createElement(Trash2, { size: 16 })}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Port Interface (for port definitions/usages) */}
          {(nodeData.kind === 'port-definition' || nodeData.kind === 'port-usage') && (
            <div style={styles.field}>
              <label style={styles.label}>Interface Reference</label>
              <input
                type="text"
                value={portInterface}
                onChange={(e) => setPortInterface(e.target.value)}
                style={styles.input}
                placeholder="Interface definition name (optional)"
              />
            </div>
          )}

          {/* Compartment Visibility */}
          {nodeData.compartments && nodeData.compartments.length > 0 && (
            <div style={styles.field}>
              <label style={styles.label}>Compartments</label>
              <div style={styles.compartmentList}>
                {nodeData.compartments.map((compartment, index) => (
                  <div key={index} style={styles.compartmentItem}>
                    <button
                      type="button"
                      style={styles.toggleButton}
                      onClick={() => toggleCompartmentVisibility(index)}
                      title={compartmentVisibility[index] ? 'Hide compartment' : 'Show compartment'}
                    >
                      {compartmentVisibility[index]
                        ? React.createElement(Eye, { size: 16 })
                        : React.createElement(EyeOff, { size: 16 })
                      }
                    </button>
                    <div style={styles.compartmentInfo}>
                      <div style={styles.compartmentTitle}>
                        {compartment.title || `Compartment ${index + 1}`}
                      </div>
                      <div style={styles.compartmentItems}>
                        {compartment.items.length} item(s)
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Element Info */}
          <div style={styles.infoSection}>
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>Kind:</span>
              <span style={styles.infoValue}>{formatKind(nodeData.kind)}</span>
            </div>
            {nodeData.elementKind && (
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>Type:</span>
                <span style={styles.infoValue}>{nodeData.elementKind}</span>
              </div>
            )}
            {nodeData.baseDefinition && (
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>Base Definition:</span>
                <span style={styles.infoValue}>{nodeData.baseDefinition}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <button style={styles.cancelButton} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            style={styles.saveButton}
            onClick={handleSave}
            disabled={!name.trim()}
          >
            {React.createElement(Save, { size: 16, style: styles.buttonIcon })}
            <span>Save Changes</span>
          </button>
        </div>
      </div>

      {/* Action Picker Modal */}
      <ActionPicker
        isOpen={actionPickerOpen}
        onClose={() => {
          setActionPickerOpen(false);
          setActionPickerTarget(null);
        }}
        onSelect={handleActionSelect}
        availableActions={availableActions}
        currentSelection={
          actionPickerTarget === 'entry' && isActionReference(entryAction)
            ? entryAction
            : actionPickerTarget === 'do' && isActionReference(doAction)
            ? doAction
            : actionPickerTarget === 'exit' && isActionReference(exitAction)
            ? exitAction
            : undefined
        }
      />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
    width: '95%',
    maxWidth: '800px',
    maxHeight: '95vh',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    padding: '20px 24px',
    borderBottom: '1px solid #e0e0e0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    margin: 0,
    fontSize: '20px',
    fontWeight: 600,
    color: '#333',
  },
  subtitle: {
    marginTop: '4px',
    fontSize: '13px',
    color: '#666',
  },
  closeButton: {
    padding: '4px',
    border: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    color: '#666',
    borderRadius: '4px',
    transition: 'background-color 0.2s',
  },
  content: {
    padding: '24px',
    overflowY: 'auto',
    overflowX: 'hidden',
    flex: 1,
    minHeight: 0, // Ensures proper flex scrolling behavior
  },
  field: {
    marginBottom: '20px',
  },
  label: {
    display: 'block',
    marginBottom: '6px',
    fontSize: '14px',
    fontWeight: 500,
    color: '#333',
  },
  hint: {
    fontWeight: 400,
    color: '#999',
    fontSize: '13px',
  },
  input: {
    width: '100%',
    padding: '8px 12px',
    fontSize: '14px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    boxSizing: 'border-box',
  },
  textarea: {
    width: '100%',
    padding: '8px 12px',
    fontSize: '14px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    resize: 'vertical',
  },
  compartmentList: {
    border: '1px solid #ddd',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  compartmentItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px',
    borderBottom: '1px solid #f0f0f0',
    gap: '12px',
  },
  toggleButton: {
    padding: '6px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    backgroundColor: 'white',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#666',
    transition: 'all 0.2s',
  },
  compartmentInfo: {
    flex: 1,
  },
  compartmentTitle: {
    fontSize: '14px',
    fontWeight: 500,
    color: '#333',
  },
  compartmentItems: {
    fontSize: '12px',
    color: '#999',
    marginTop: '2px',
  },
  parameterHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  addButton: {
    padding: '6px 12px',
    fontSize: '13px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#007bff',
    borderRadius: '4px',
    backgroundColor: 'white',
    color: '#007bff',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    transition: 'all 0.2s',
  },
  emptyMessage: {
    padding: '16px',
    textAlign: 'center',
    color: '#999',
    fontSize: '13px',
    fontStyle: 'italic',
    border: '1px solid #f0f0f0',
    borderRadius: '4px',
    backgroundColor: '#fafafa',
  },
  parameterList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  parameterItem: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    padding: '8px',
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
    backgroundColor: '#fafafa',
  },
  parameterItemInherited: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    padding: '8px',
    border: '1px solid #d0d0d0',
    borderRadius: '4px',
    backgroundColor: '#f0f0f0',
    opacity: 0.8,
    position: 'relative',
  },
  inheritedBadge: {
    position: 'absolute',
    top: '-8px',
    left: '8px',
    fontSize: '10px',
    fontWeight: 600,
    color: '#666',
    backgroundColor: '#e8e8e8',
    padding: '2px 6px',
    borderRadius: '3px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  paramInput: {
    flex: 1,
    padding: '6px 8px',
    fontSize: '13px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#ddd',
    borderRadius: '4px',
    backgroundColor: 'white',
  },
  paramSelect: {
    padding: '6px 8px',
    fontSize: '13px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#ddd',
    borderRadius: '4px',
    backgroundColor: 'white',
    width: '80px',
  },
  removeButton: {
    padding: '6px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#dc3545',
    borderRadius: '4px',
    backgroundColor: 'white',
    color: '#dc3545',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    transition: 'all 0.2s',
  },
  infoSection: {
    marginTop: '24px',
    padding: '16px',
    backgroundColor: '#f9f9f9',
    borderRadius: '4px',
    border: '1px solid #e0e0e0',
  },
  infoRow: {
    display: 'flex',
    marginBottom: '8px',
    fontSize: '13px',
  },
  infoLabel: {
    fontWeight: 500,
    color: '#666',
    minWidth: '140px',
  },
  infoValue: {
    color: '#333',
  },
  footer: {
    padding: '16px 24px',
    borderTop: '1px solid #e0e0e0',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
  },
  cancelButton: {
    padding: '8px 16px',
    fontSize: '14px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    backgroundColor: 'white',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  saveButton: {
    padding: '8px 16px',
    fontSize: '14px',
    border: 'none',
    borderRadius: '4px',
    backgroundColor: '#007bff',
    color: 'white',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'all 0.2s',
  },
  buttonIcon: {
    flexShrink: 0,
  },
  conditionItem: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    padding: '8px',
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
    backgroundColor: '#fafafa',
  },
  conditionInput: {
    flex: 1,
    padding: '6px 8px',
    fontSize: '13px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#ddd',
    borderRadius: '4px',
    backgroundColor: 'white',
  },
  transitionItem: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    padding: '8px',
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
    backgroundColor: '#fafafa',
  },
  section: {
    marginBottom: '24px',
    padding: '16px',
    backgroundColor: '#f8f9fa',
    border: '1px solid #e0e0e0',
    borderRadius: '6px',
  },
  sectionTitle: {
    margin: '0 0 16px 0',
    fontSize: '16px',
    fontWeight: 600,
    color: '#333',
    paddingBottom: '8px',
    borderBottom: '2px solid #007bff',
  },
  actionFieldWrapper: {
    display: 'flex',
    gap: '8px',
    alignItems: 'flex-start',
  },
  actionDisplay: {
    flex: 1,
  },
  actionButtons: {
    display: 'flex',
    gap: '8px',
  },
  actionReferenceDisplay: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    border: '2px solid #007bff',
    borderRadius: '4px',
    backgroundColor: '#e3f2fd',
  },
  actionReferenceName: {
    fontSize: '14px',
    fontWeight: 500,
    color: '#333',
  },
  actionReferenceType: {
    fontSize: '12px',
    color: '#666',
  },
  createButton: {
    padding: '6px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#28a745',
    borderRadius: '4px',
    backgroundColor: 'white',
    color: '#28a745',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    transition: 'all 0.2s',
  },
  linkButton: {
    padding: '6px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#007bff',
    borderRadius: '4px',
    backgroundColor: 'white',
    color: '#007bff',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    transition: 'all 0.2s',
  },
  unlinkButton: {
    padding: '6px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#ff9800',
    borderRadius: '4px',
    backgroundColor: 'white',
    color: '#ff9800',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    transition: 'all 0.2s',
  },
};

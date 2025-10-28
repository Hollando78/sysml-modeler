import express, { Request, Response } from 'express';
import { z } from 'zod';
import * as modelService from '../services/sysml/model-service.js';
import * as diagramService from '../services/sysml/diagram-service.js';
import { allViewpoints, getAvailableTypesForViewpoint } from '../services/sysml/viewpoints.js';

const router = express.Router();

// Validation schemas
const createElementSchema = z.object({
  kind: z.string(),
  spec: z.record(z.any()),
});

const updateElementSchema = z.object({
  updates: z.record(z.any()),
});

const createRelationshipSchema = z.object({
  id: z.string(),
  type: z.string(),
  source: z.string(),
  target: z.string(),
  label: z.string().optional(),
});

const updatePositionSchema = z.object({
  viewpointId: z.string(),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
});

const createDiagramSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  viewpointId: z.string(),
  elementIds: z.array(z.string()).optional(),
  positions: z.record(z.object({ x: z.number(), y: z.number() })).optional(),
});

const updateDiagramSchema = z.object({
  name: z.string().optional(),
  viewpointId: z.string().optional(),
});

const addElementsSchema = z.object({
  elementIds: z.array(z.string()),
});

const updateDiagramPositionSchema = z.object({
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
});

const bulkUpdatePositionsSchema = z.object({
  positions: z.record(z.object({ x: z.number(), y: z.number() })),
});

// ============================================================================
// DIAGRAM ROUTES
// ============================================================================

/**
 * GET /api/sysml/diagrams?viewpoint=sysml.requirement
 * Get all diagrams, optionally filtered by viewpoint
 */
router.get('/diagrams', async (req: Request, res: Response) => {
  try {
    const viewpointId = req.query.viewpoint as string | undefined;
    const diagrams = await diagramService.fetchDiagrams(viewpointId);
    res.json(diagrams);
  } catch (error) {
    console.error('Error fetching diagrams:', error);
    res.status(500).json({ error: 'Failed to fetch diagrams' });
  }
});

/**
 * GET /api/sysml/diagrams/:id
 * Get a specific diagram
 */
router.get('/diagrams/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const diagram = await diagramService.fetchDiagram(id);

    if (!diagram) {
      return res.status(404).json({ error: 'Diagram not found' });
    }

    res.json(diagram);
  } catch (error) {
    console.error('Error fetching diagram:', error);
    res.status(500).json({ error: 'Failed to fetch diagram' });
  }
});

/**
 * POST /api/sysml/diagrams
 * Create a new diagram
 */
router.post('/diagrams', async (req: Request, res: Response) => {
  try {
    const diagramSpec = createDiagramSchema.parse(req.body);
    const diagram = await diagramService.createDiagram(diagramSpec);
    res.status(201).json(diagram);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
    } else {
      console.error('Error creating diagram:', error);
      res.status(500).json({ error: 'Failed to create diagram' });
    }
  }
});

/**
 * PATCH /api/sysml/diagrams/:id
 * Update diagram metadata (name, viewpointId)
 */
router.patch('/diagrams/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = updateDiagramSchema.parse(req.body);
    await diagramService.updateDiagram(id, updates);
    res.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
    } else {
      console.error('Error updating diagram:', error);
      res.status(500).json({ error: 'Failed to update diagram' });
    }
  }
});

/**
 * DELETE /api/sysml/diagrams/:id
 * Delete a diagram
 */
router.delete('/diagrams/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await diagramService.deleteDiagram(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting diagram:', error);
    res.status(500).json({ error: 'Failed to delete diagram' });
  }
});

/**
 * POST /api/sysml/diagrams/:id/elements
 * Add elements to a diagram
 */
router.post('/diagrams/:id/elements', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { elementIds } = addElementsSchema.parse(req.body);
    await diagramService.addElementsToDiagram(id, elementIds);
    res.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
    } else {
      console.error('Error adding elements to diagram:', error);
      res.status(500).json({ error: 'Failed to add elements to diagram' });
    }
  }
});

/**
 * DELETE /api/sysml/diagrams/:id/elements/:elementId
 * Remove an element from a diagram
 */
router.delete('/diagrams/:id/elements/:elementId', async (req: Request, res: Response) => {
  try {
    const { id, elementId } = req.params;
    await diagramService.removeElementFromDiagram(id, elementId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error removing element from diagram:', error);
    res.status(500).json({ error: 'Failed to remove element from diagram' });
  }
});

/**
 * PATCH /api/sysml/diagrams/:id/elements/:elementId/position
 * Update element position within a diagram
 */
router.patch('/diagrams/:id/elements/:elementId/position', async (req: Request, res: Response) => {
  try {
    const { id, elementId } = req.params;
    const { position } = updateDiagramPositionSchema.parse(req.body);
    await diagramService.updateElementPositionInDiagram(id, elementId, position);
    res.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
    } else {
      console.error('Error updating element position in diagram:', error);
      res.status(500).json({ error: 'Failed to update element position in diagram' });
    }
  }
});

/**
 * PATCH /api/sysml/diagrams/:id/positions
 * Bulk update positions for all elements in a diagram
 */
router.patch('/diagrams/:id/positions', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { positions } = bulkUpdatePositionsSchema.parse(req.body);
    await diagramService.updateDiagramPositions(id, positions);
    res.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
    } else {
      console.error('Error updating diagram positions:', error);
      res.status(500).json({ error: 'Failed to update diagram positions' });
    }
  }
});

// ============================================================================
// MODEL & ELEMENT ROUTES
// ============================================================================

/**
 * GET /api/sysml/model?viewpoint=sysml.requirement
 * Fetch the entire model, optionally filtered by viewpoint
 */
router.get('/model', async (req: Request, res: Response) => {
  try {
    const viewpointId = req.query.viewpoint as string | undefined;
    const model = await modelService.fetchModel(viewpointId);
    res.json(model);
  } catch (error) {
    console.error('Error fetching model:', error);
    res.status(500).json({ error: 'Failed to fetch model' });
  }
});

/**
 * GET /api/sysml/viewpoints
 * Get all available viewpoints
 */
router.get('/viewpoints', (_req: Request, res: Response) => {
  res.json(allViewpoints);
});

/**
 * GET /api/sysml/viewpoints/:id/types
 * Get available types for a specific viewpoint
 */
router.get('/viewpoints/:id/types', (req: Request, res: Response) => {
  const viewpointId = req.params.id;
  const types = getAvailableTypesForViewpoint(viewpointId);
  res.json(types);
});

/**
 * POST /api/sysml/elements
 * Create a new element
 */
router.post('/elements', async (req: Request, res: Response) => {
  try {
    const nodeSpec = createElementSchema.parse(req.body);
    await modelService.createElement(nodeSpec);
    res.status(201).json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
    } else {
      console.error('Error creating element:', error);
      res.status(500).json({ error: 'Failed to create element' });
    }
  }
});

/**
 * PATCH /api/sysml/elements/:id
 * Update an element
 */
router.patch('/elements/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { updates } = updateElementSchema.parse(req.body);
    await modelService.updateElement(id, updates);
    res.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
    } else {
      console.error('Error updating element:', error);
      res.status(500).json({ error: 'Failed to update element' });
    }
  }
});

/**
 * DELETE /api/sysml/elements/:id
 * Delete an element
 */
router.delete('/elements/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await modelService.deleteElement(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting element:', error);
    res.status(500).json({ error: 'Failed to delete element' });
  }
});

/**
 * POST /api/sysml/relationships
 * Create a new relationship
 */
router.post('/relationships', async (req: Request, res: Response) => {
  try {
    const relationshipSpec = createRelationshipSchema.parse(req.body);
    await modelService.createRelationship(relationshipSpec);
    res.status(201).json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
    } else {
      console.error('Error creating relationship:', error);
      res.status(500).json({ error: 'Failed to create relationship' });
    }
  }
});

/**
 * DELETE /api/sysml/relationships/:id
 * Delete a relationship
 */
router.delete('/relationships/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await modelService.deleteRelationship(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting relationship:', error);
    res.status(500).json({ error: 'Failed to delete relationship' });
  }
});

/**
 * PATCH /api/sysml/elements/:id/position
 * Update element position for a viewpoint
 */
router.patch('/elements/:id/position', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { viewpointId, position } = updatePositionSchema.parse(req.body);
    await modelService.updateElementPosition(id, viewpointId, position);
    res.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
    } else {
      console.error('Error updating position:', error);
      res.status(500).json({ error: 'Failed to update position' });
    }
  }
});

export default router;

import express from 'express';
import { Router, Request, Response } from 'express';
import { logger } from '../lib/logger';

const router = Router();

router.post('/csp-report', express.json({ type: 'application/csp-report' }), (req: Request, res: Response) => {
  const report = req.body['csp-report'] || req.body;
  logger.warn({
    'csp-report': {
      'document-uri': report['document-uri'],
      'referrer': report['referrer'],
      'violated-directive': report['violated-directive'],
      'effective-directive': report['effective-directive'],
      'original-policy': report['original-policy'],
      'blocked-uri': report['blocked-uri'],
      'line-number': report['line-number'],
      'column-number': report['column-number'],
      'source-file': report['source-file'],
      'status-code': report['status-code'],
      'script-sample': report['script-sample'],
    },
  }, 'CSP Violation Report');
  res.status(204).end();
});

export default router;
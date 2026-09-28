import type { Request, Response } from 'express';
import { hostedInference } from '../../server/hosted-inference';

export default async function handler(req: Request, res: Response) {
  return hostedInference(req, res);
}

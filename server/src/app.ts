import './lib/loadEnv.js';
import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import { ZodError } from 'zod';
import { authRouter } from './routes/auth.routes.js';
import { employeesRouter } from './routes/employees.routes.js';
import { departmentsRouter } from './routes/departments.routes.js';
import { companiesRouter } from './routes/companies.routes.js';
import { usersRouter } from './routes/users.routes.js';
import { onboardingRouter } from './routes/onboarding.routes.js';
import { payrollRouter } from './routes/payroll.routes.js';
import { payslipsRouter } from './routes/payslips.routes.js';
import { leavesRouter } from './routes/leaves.routes.js';
import { reviewsRouter } from './routes/reviews.routes.js';
import { notificationsRouter } from './routes/notifications.routes.js';
import { peerFeedbackRouter } from './routes/peerFeedback.routes.js';
import { comptaRouter } from './routes/compta.routes.js';
import { paymentsRouter } from './routes/payments.routes.js';
import { treasuryRouter } from './routes/treasury.routes.js';
import { advancesRouter } from './routes/advances.routes.js';
import { adminRouter } from './routes/admin.routes.js';
import { HttpError } from './lib/errors.js';

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000' }));
app.use(express.json());
app.use('/uploads', express.static('uploads'));

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRouter);
app.use('/api/companies', companiesRouter);
app.use('/api/users', usersRouter);
app.use('/api/employees', employeesRouter);
app.use('/api/departments', departmentsRouter);
app.use('/api/onboarding', onboardingRouter);
app.use('/api/payroll', payrollRouter);
app.use('/api/payslips', payslipsRouter);
app.use('/api/leaves', leavesRouter);
app.use('/api/reviews', reviewsRouter);
app.use('/api/reviews', peerFeedbackRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/treasury', treasuryRouter);
app.use('/api/advances', advancesRouter);
app.use('/api/admin', adminRouter);

// Passerelle LaafiPay -> LaafiCompta
app.use('/api/compta', comptaRouter);

app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.method} ${req.path} introuvable` });
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ message: err.message });
  }
  // Sans ce cas, TOUTE erreur .parse() Zod (n'importe quelle route) tombait
  // en 500 "Erreur serveur" générique — masquant au frontend le message de
  // validation utile (ex. "Devise incompatible avec le pays sélectionné").
  if (err instanceof ZodError) {
    return res.status(400).json({
      message: err.issues.map((issue) => issue.message).join(', '),
      errors: err.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    });
  }
  console.error(err);
  res.status(500).json({ message: 'Erreur serveur' });
});

export default app;
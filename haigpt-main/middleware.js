import cookieParser from 'cookie-parser';
import express from 'express';

export function setupMiddleware(app) {
    app.set('trust proxy', true);
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(cookieParser());
}
#include "stdafx.h"
#include <math.h>
  #pragma once
#ifdef FOO
double inIfdef = 1;
#else
double inElse = 2;
#endif
#define WIDTH 100 // comment after the value
#define HALF (WIDTH / 2)
#define SQR(x) ((x) * (x))
#define QUAD(x) (SQR(x) * SQR(x))
#define ADD3(a, b, c) (a + b + c)
#define EMPTY
#define STR "text"
#define NEG -5
#define BAD (unknownThing * 2)
#define LATER (laterVar + 1)
#define FNOARGS() (7)
#define SELF(x) (x + x)
#define DUP(a, a) (a)
#define MISSINGCLOSE(x (x)
#define  SPACED   3
#defineGLUED 4
#define DIVZ(x) (x / 0)
#define PT(x, y) FdPoint3d(x, y, 0)
#define WIDTH 200
/*
#define INCOMMENT 11
*/
#define LONGMACRO 1 + \
   2;
//@line 999
//@line 36
//@eval WIDTH
//@eval SQR(3)
//@eval HALF + SPACED
//@eval a
//@eval INCOMMENT + GLUED
//@eval DIVZ(1)
//@eval SQR(1, 2)
double w = WIDTH;
double h = HALF;
double s = SQR(HALF);
double q = QUAD(2);
double t = ADD3(1, 2.5, w);
char *str = STR;
int neg = NEG;
double f0 = FNOARGS();
double x = 3;
double y = SELF(x + 1);
double z = x;
double dup = DUP(1, 2);
double leaked = a;
double sp = SPACED + GLUED + INCOMMENT;
double bad = BAD;
double later = LATER;
double laterVar = 1;
double later2 = LATER;
double empty = EMPTY;
double fn = FNOARGS;
double wrong = SQR(1, 2);
double dz = DIVZ(5);
double afterDz = x;
FdPoint3d pt = PT(1, 2);
makeSimpleTube(PT(0, 0), PT(w, h), SQR(2), HALF, cpx);
double missing = MISSINGCLOSE(1);
double longm = LONGMACRO;

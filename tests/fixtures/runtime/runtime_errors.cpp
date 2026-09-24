// Runtime errors become diagnostics on the statement's first line.
//@line 999
//@eval 1 / 0
//@eval 5 % 0
//@eval vx
//@eval "text"
//@eval true
//@eval
//@eval    
//@eval sqrt(-1)
//@eval 1e308 * 10
//@eval nothingHere
//@eval sin(M_PI / 2) + cos(0) + tan(0)
//@eval (1 +
//@eval 1 2
double a = 1 / 0;
double b = 5 % 0;
double c = unknownVariable + 1;
double d = vx + 1;
FdPoint3d e = FdPoint3d(0, 0, 0) + FdPoint3d(1, 1, 1);
double f = sqrt(fabs(-4));
double g = unsupportedFunction(1, 2);
double h = sin(1, 2);
double i = (1 + 2;
double j = 1 2;
double k = )1;
double l = [1];
double m = "a" * 2;
double n = abs("x");
double o = strcmp("a");
double p = strcmp("a", 1);
int q = strcmp("abc", "abd") + strcmp("b", "a") * 10 + strcmp("same", "same") * 100;
double r = pow(2, 10) + pow(1, 1e400) + pow(-1, 1e400) + pow(0.5, 0);
double s = floor(-2.5) + ceil(-2.5) * 10 + round(-2.5) * 100 + round(2.5) * 1000 + round(0.49999999999999994);
double t = fabs(-3) + abs(-4.5) + atan2(1, 1) + asin(1) + acos(0) + atan(1);
double u = pow(2);
double v = atan2(1);
double w = 1 ? 2;
double x = std::sqrt(4);
double y = p->x;
double z = a.b.c;
double aa = sqrt(4) * sqrt(2.25);
double bb = floor(7.9) + ceil(7.1) + round(-0.5);

// C-style, functional and static_cast conversions.
//@eval (int)7.9
//@eval static_cast<double>(1) / 4
//@eval int(-2.5)
double a = (int)7.9;
int b = (double)7;
double c = (ads_real)3;
bool d = (bool)0.5;
int e = (FLM3Geo::primitiveMode)2.7;
int f = (const int)3.5;
int g = (short)(-3.9);
int h = (long)1e3;
double i = (float)1;
int j = int(2.9);
double k = double(3);
double l = ads_real(2);
bool m = bool(0);
int n = int();
double o = double();
int p = primitiveMode(1.5);
int q = FLM3Geo::primitiveMode(2);
int r = static_cast<int>(9.99);
double s = static_cast<ads_real>(5);
bool t = static_cast<bool>(3);
int u = static_cast<const int>(4.4);
FdPoint3d pt(1, 2, 3);
double v = static_cast<FdPoint3d>(pt);
double w = (FdPoint3d)pt;
double x = (char)1;
double y = int(1, 2);
double z = static_cast<int(3);
double aa = static_cast<int>3;
double bb = (int)(2.5 + 1) * 2;
double cc = (int)2.5 + 1.5;
double dd = int(pt);
char *ee = (char *)"x";

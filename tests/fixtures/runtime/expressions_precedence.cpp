// Operator precedence, arithmetic types, comparisons and logic.
//@eval 1 + 2 * 3 - 4 / 2
//@eval (1 + 2) * 3
//@eval 7 % 3 * 2
//@eval -2 * -3
//@eval 1 < 2 == 3 > 2
//@eval 1 ? 2 : 3
//@eval 0 ? 1 : 0 ? 2 : 3
int a = 1 + 2 * 3 - 4 / 2;
double b = (1 + 2) * 3;
int c = 7 % 3 * 2;
int d = 10 - 3 - 2;
double e = 100 / 10 / 5;
double f = 2 * 3 % 4;
double g = -2 * -3;
double h = - - 4;
double i = + 5;
bool j = !0;
bool k = !!3;
bool l = 1 < 2 == 3 > 2;
bool m = 1 == 1.0;
bool n = true == 1;
bool o = "a" == "a";
bool p = "a" != "b";
bool q = vx == vx;
bool r = vx == vy;
bool s = FdPoint3d(1, 2, 3) == FdPoint3d(1, 2, 3);
bool t = vx == FdPoint3d(1, 0, 0);
bool u = NULL == NULL;
bool v = nullptr == 0;
bool w = "abc" < "abd";
bool x = "b" >= "a";
bool y = 2.5 <= 2;
bool z = true > false;
double t1 = 1 ? 2 : 3;
double t2 = 0 ? 1 : 0 ? 2 : 3;
double t3 = 1 > 0 ? 10 : 1 / 0;
double t4 = a > 100 ? a : -a;
bool l1 = 0 && 1;
bool l2 = 0 || 2;
bool l3 = 1 && 2 && 0 || 1;
bool l4 = a != 0 && 10 / a > 1;
int zero = 0;
bool l5 = zero != 0 && 10 / zero > 1;
bool l6 = zero == 0 || 10 % zero;
double cmpErr = vx < vy;
double cmpErr2 = "a" < 1;
char *cat = "ab" + "cd";
char *catErr = "ab" + 1;
double subErr = "ab" - "a";
double mulErr = vx * vy;
FdVector3d mulOk = 2 * vx * 3;
FdVector3d divOk = vx / 4;
FdVector3d divZero = vx / 0;
double divVec = 1 / vx;
double modD = 7.5 % 2.5;
double modZ = 7 % 0.5;
double divD = 1 / 0.0;
double modVec = vx % 2;
double negStr = -"a";
double tern = (1 ? vx : vy).y;
double unary = -(2 + 3) * +(-1);

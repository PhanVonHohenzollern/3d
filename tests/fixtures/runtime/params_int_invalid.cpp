// Integer and double parameters that fail to parse keep the current value.
//@param Count=abc
//@param Size=
//@param Flag=
//@param Ratio=nan
//@param Inf=inf
//@param Exp=1e3
//@param IntExp=1e3
//@param Plus=+7
//@param Neg=-0
int count = 4;
double size = 2;
bool flag = true;
double ratio = 1;
double inf = 1;
double e = 0;
int ie = 0;
int plus = 0;
double neg = 5;
get_val("Count", count);
get_val("Size", size);
get_val("Flag", flag);
get_val("Ratio", ratio);
get_val("Inf", inf);
get_val("Exp", e);
get_val("IntExp", ie);
get_val("Plus", plus);
get_val("Neg", neg);
makeSimpleTube(FdPoint3d(0, 0, 0), FdPoint3d(count, size, e), ie, plus, neg);

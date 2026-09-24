// Less common expression paths: relational operators, arities, members.
//@line 999
//@eval vx[0] + vy[1] + vz[2]
//@eval FdVector3d().x
//@eval getIntInsSize(r1
//@eval getExtInsSize(
double r1 = (1 < 2) + (2 > 1) * 10 + (2 <= 2) * 100 + (1 >= 2) * 1000;
double r2 = ("a" < "b") + ("a" > "b") * 10 + ("a" <= "a") * 100 + ("b" >= "c") * 1000;
double r3 = 1.5 > 1 && 2 >= 2.0 && 3 <= 3 && -1 < 0;
double divStr = "a" / 2;
double powInf = pow(-1, -1e400) + pow(-1, 1e400) + pow(2, -1e400);
foo(1, );
foo(, );
foo(,1);
FdVector3d zeroVec = FdVector3d();
FdPoint3d zeroPt = FdPoint3d();
FdVector3d fromOne = FdVector3d(vx);
FdVector3d twoArgs = FdVector3d(1, 2);
double comps = vx[0] + vy[1] + vz[2] + vx.z + vy.y;
double idxScalar = cpx[0];
double idxString = "abc"[0];
double memberMissing = vx.;
double scoped = FLM3Geo::;
double scoped2 = FLM3Geo::primitiveMode::;
double scoped3 = FLM3Geo::primitiveMode::pmNormal + FLM3Geo::pmIntInsulation;
double notFn = FLM3Geo::pmNormal(1);
double endTok = getExtInsSize;
double endTok2 = getIntInsSize();
double a1 = sin() + 1;
double a2 = cos(1, 2);
double a3 = tan();
double a4 = asin(1, 1);
double a5 = acos();
double a6 = atan(1, 2);
double a7 = sqrt();
double a8 = floor(1, 2);
double a9 = ceil();
double a10 = round(1, 2);
double a11 = fabs();
double a12 = abs(1, 2);
double a13 = FdPoint3d(1, 2, 3, 4);
double a14 = double(1, 2);
double a15 = bool();
double a16 = short(2.5) + long(3.5);
double ok = sin(0) + cos(0) + tan(0) + asin(0) + acos(1) + atan(0) + sqrt(9) + floor(1.5) + ceil(1.5) + round(1.5) + fabs(-1) + abs(-1);

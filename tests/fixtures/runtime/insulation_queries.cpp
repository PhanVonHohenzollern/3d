// getExtInsSize / getIntInsSize: false unless a parameter is configured.
//@param getExtInsSize=25
//@param getIntInsSize=abc
//@line 999
//@eval getExtInsSize(ext)
double ext = 0;
int extInt = 0;
bool extBool = false;
double intIns = 5;
double x = 0;
if (getExtInsSize(ext))
{
    x = ext * 2;
}
if (getExtInsSize(extInt)) x = x + extInt;
if (getExtInsSize(extBool)) x = x + 1000;
if (getIntInsSize(intIns)) x = -1;
else x = x + 0.5;
if (getExtInsSize(missing)) x = -2;
if (getExtInsSize(ext, 2)) x = -3;
if (getExtInsSize(5)) x = -4;
double both = getExtInsSize(ext) ? ext : 0;
getExtInsSize(ext);
getIntInsSize(intIns);
makeSimpleTube(FdPoint3d(0, 0, 0), FdPoint3d(x, 0, 0), ext, ext, 3);

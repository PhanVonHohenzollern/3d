// get_val for every destination type, with configured parameter values.
//@param Width=250
//@param Count= 12
//@param Ratio=0.75abc
//@param Flag=yes
//@param Flag2=off
//@param Flag3=maybe
//@param Name=hello world
//@param Elem=3.5
//@param PtParam=1
//@param BadInt=12.5
//@param Big=1e400
//@param Hex=0x10
//@param Neg=-4
//@param Spaces=  8  
//@eval Width
//@eval Count * 2
//@eval W
//@eval arr[1]
//@eval Elem
//@line 999
//@line 22
double W = 200;
int count = 3;
double ratio = 0.5;
bool flag = false;
bool flag2 = true;
bool flag3 = true;
char *name = "default";
char *emptyName;
double arr[3] = {1, 2, 3};
FdPoint3d pt(1, 2, 3);
int badInt = 7;
double big = 1;
double hex = 0;
int neg = 0;
int spaces = 0;
double noParam = 42;
get_val("Width", W);
get_val("Count", count);
get_val("Ratio", ratio);
get_val("Flag", flag);
get_val("Flag2", flag2);
get_val("Flag3", flag3);
get_val("Name", name);
get_val("Empty", emptyName);
get_val("Elem", arr[1]);
get_val("PtParam", pt);
get_val("BadInt", badInt);
get_val("Big", big);
get_val("Hex", hex);
get_val("Neg", neg);
get_val("Spaces", spaces);
get_val("NoParam", noParam);
get_val("Width", W);
get_val("Width", ratio);
get_val(W, W);
get_val("Width");
get_val("Missing", missingVar);
get_val("Unset", someOpaque);
double derived = W * 2 + count;
